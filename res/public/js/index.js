import {io} from "https://cdn.socket.io/4.4.1/socket.io.esm.min.js";

const socket = io();

let minZoom = 20;
let maxZoom = 200;
let zoom = minZoom;

let currentColor = "rgb(217, 217, 217)";
let offsetX = 0;
let offsetY = 0;
let imageCache = [];
let width = 50, height = 50;
let timeout = Date.now() / 1000;
let lastSelected = document.querySelector("div[title=Pomodoro]");

const canvas = document.getElementById("canvas");
canvas.width = canvas.getBoundingClientRect().width;
canvas.height = canvas.getBoundingClientRect().height;
const ctx = canvas.getContext("2d");

window.addEventListener('resize', () => {
    canvas.width = canvas.getBoundingClientRect().width;
    canvas.height = canvas.getBoundingClientRect().height;
    setTimeout(() => redrawAll(), 1);
}, true);

function selectColor(event) {
    currentColor = event.target.style.backgroundColor;
    event.target.classList.add("active");
    lastSelected.classList.remove("active");
    document.getElementById("clr-parent").innerHTML = "";
    lastSelected = event.target;
}

setInterval(() => {
    const leftTimeout = Math.max(0, timeout - Date.now() / 1000);
    const seconds = Math.floor(leftTimeout % 60);
    document.querySelector("div[class=pc-number]").innerText =
        `${Math.floor(leftTimeout / 60)}:${seconds < 10 ? "0" : ""}${seconds}`;
}, 1000);

socket.on("error", error => {
    if (error === "invalidHash") return window.location.reload();
    post("/error", {error});
});

socket.on("timeoutUpdated", t => timeout = t);
socket.on("update", (x, y, colorArr) => {
    const i = (y * height + x) * 4;
    imageCache[i] = colorArr[0];
    imageCache[i + 1] = colorArr[1];
    imageCache[i + 2] = colorArr[2];
    redrawAll();
});
socket.on("updateAll", (w, h, buffer) => {
    width = w;
    height = h;
    imageCache = new Uint8Array(buffer);
    redrawAll();
});

function createListeners() {
    let scaling = false;
    let prevDiff = 0;
    document.querySelectorAll("div[class*='color-selector']:not(#colorpicker)")
        .forEach(x => x.addEventListener("click", e => selectColor(e)));

    document.getElementById("colorpicker").addEventListener("click", e => {
        const parent = document.getElementById("clr-parent");
        if (parent.children.length !== 0)
            return document.getElementById("clr-parent").innerHTML = "";

        Coloris({
            parent: "#clr-parent",
            themeMode: 'dark',
            theme: "large",
            alpha: false,
            inline: true
        });
        document.getElementById("colorpicker").classList.add("active");
        lastSelected.classList.remove("active");
        lastSelected = document.getElementById("colorpicker");
        parent.style.left = `${e.clientX}px`;
        parent.style.top = `${e.clientY - parent.getBoundingClientRect().height}px`;
    });

    document.addEventListener("coloris:pick", e => {
        const s = hexToStr(e.detail.color);
        currentColor = `rgb(${s.r}, ${s.g}, ${s.b})`;
        document.getElementById("colorpicker").style.backgroundColor = currentColor;
    });

    canvas.addEventListener("wheel", e => {
        e.preventDefault();
        zoom = clamp(Math.floor((zoom - e.deltaY / 100) * 10) / 10, minZoom, maxZoom);
        redrawAll();
    });
    let move = false;
    canvas.addEventListener("mousedown", e => {
        e.preventDefault();
        if (e.button !== 1) return;
        move = true;
    });
    canvas.addEventListener("mouseup", e => {
        e.preventDefault();
        if (!move) {
            placePixel(e);
        }
        if (e.button !== 1) return;
        move = false;
    });

    canvas.addEventListener("mousemove", e => {
        if (!move) return;

        offsetX += e.movementX;
        offsetY += e.movementY;
        redrawAll();
    });

    let lastX, lastY;
    canvas.addEventListener("touchmove", e => {
        e.preventDefault();
        if (e.touches.length !== 1) return;
        if (lastX && lastY) {
            offsetX = lerp(offsetX, offsetX + e.touches[0].clientX - lastX, .5);
            offsetY = lerp(offsetY, offsetY + e.touches[0].clientY - lastY, .5);
        }
        lastX = e.touches[0].clientX;
        lastY = e.touches[0].clientY;
        redrawAll();
    });
    canvas.addEventListener("touchend", e => {
        lastX = undefined;
        lastY = undefined;
    });

    canvas.addEventListener("touchstart", e => {
        if (e.touches.length !== 2) return;
        scaling = true;
    });

    canvas.addEventListener("touchmove", e => {
        if (e.touches.length !== 2) return;
        const deltaX = e.touches[0].clientX - e.touches[1].clientX;
        const deltaY = e.touches[0].clientY - e.touches[1].clientY;

        const currDiff = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        const val = Math.abs(currDiff - prevDiff);

        if (prevDiff > 0 && val >= 10) {
            zoom = lerp(zoom, zoom + (currDiff > prevDiff ? 1 : -1) * 25, .02);
            redrawAll();
        }

        prevDiff = currDiff;
    });
    canvas.addEventListener("touchend", e => {
        if (e.touches.length !== 2) return;
        scaling = false;
        prevDiff = 0;
    });
}

function placePixel(event) {
    if (window.location.search !== "?user=admin&userId=0" && timeout > Date.now() / 1000)
        return popup("Woah, slow down there! Wait till the timeout has worn off before you place a pixel again");

    const pixX = Math.floor((event.clientX - offsetX) / zoom), pixY = Math.floor((event.clientY - offsetY) / zoom);
    if (pixX < 0 || pixX >= width || pixY < 0 || pixY > height)
        return popup("You can't place pixels there!");

    socket.emit("mouseDown",
        pixX,
        pixY,
        hexToRgb(currentColor)
    );
}

function redrawAll() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const negativeOffsetX = -offsetX;
    const negativeOffsetY = -offsetY;
    const maxViewWidth = window.innerWidth / zoom;
    const maxViewHeight = window.innerHeight / zoom;
    for (let i = clamp(Math.ceil(negativeOffsetX / zoom) - 1, 0, width);
         i < clamp(Math.ceil(negativeOffsetX / zoom + maxViewWidth), 0, width); i++)
        for (let j = clamp(Math.ceil(negativeOffsetY / zoom) - 1, 0, height);
             j < clamp(Math.ceil(negativeOffsetY / zoom + maxViewHeight), 0, height); j++)
            drawRect(i, j, getPixel(i, j))

    drawGrid();
}

function getPixel(x, y) {
    const i = (y * height + x) * 4;
    return `rgb(${imageCache[i]}, ${imageCache[i + 1]}, ${imageCache[i + 2]}`;
}

function drawGrid() {
    if (zoom < minZoom)
        return;

    let cWidth = canvas.width;
    let cHeight = canvas.height;
    ctx.strokeStyle = `rgba(100, 100, 100, ${remap(zoom, minZoom, maxZoom, .3, 1)})`;
    for (let i = 0; i < cWidth; i += zoom)
        ctx.strokeRect(clamp(i + offsetX % zoom, offsetX, offsetX + width * zoom), offsetY, 0, height * zoom);
    for (let i = 0; i < cHeight; i += zoom)
        ctx.strokeRect(offsetX, clamp(i + offsetY % zoom, offsetY, offsetY + height * zoom), width * zoom, 0);
}

function drawRect(x, y, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x * zoom + offsetX, y * zoom + offsetY, zoom, zoom);
}

createListeners();
