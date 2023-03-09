import {io} from "https://cdn.socket.io/4.4.1/socket.io.esm.min.js";
import {ChunkedImage} from "./chunkedImage.js";
import {maxZoom, minZoom, Renderer} from "./renderer.js";

export let width = 50;
export let height = 50;

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

export const socket = io();
export let timeout = Date.now() / 1000;

export const image = new ChunkedImage();
export let renderer;

let currentColor = "rgb(217, 217, 217)";
let imageCache = [];
let lastSelected = document.querySelector("div[title=Pomodoro]");

document.addEventListener("DOMContentLoaded", load);
async function load() {
    renderer = new Renderer(canvas, ctx);
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
        renderer.renderPixel(x, y, arrayToRgb(colorArr));
    });
    socket.on("postStats", async (w, h, cS) => {
        width = w;
        height = h;
        image.chunkSize = cS;
        await renderer.renderAll();
    });

    window.addEventListener('resize', () => {
        canvas.width = canvas.getBoundingClientRect().width;
        canvas.height = canvas.getBoundingClientRect().height;
        setTimeout(() => renderer.renderAll(), 1);
    }, true);
}

function selectColor(event) {
    currentColor = event.target.style.backgroundColor;
    event.target.classList.add("active");
    lastSelected.classList.remove("active");
    document.getElementById("clr-parent").innerHTML = "";
    lastSelected = event.target;
}

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

    canvas.addEventListener("wheel", async e => {
        e.preventDefault();
        const nextZoom = clamp(Math.floor((renderer.zoom - e.deltaY / 100) * 10) / 10, minZoom, maxZoom);

        renderer.offsetX = -((e.clientX - renderer.offsetX) / renderer.zoom * nextZoom - e.clientX);
        renderer.offsetY = -((e.clientY - renderer.offsetY) / renderer.zoom * nextZoom - e.clientY);

        renderer.zoom = nextZoom;
        await renderer.renderAll();
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

    canvas.addEventListener("mousemove", async e => {
        if (!move) return;

        renderer.offsetX += e.movementX;
        renderer.offsetY += e.movementY;
        await renderer.renderAll();
    });

    let lastX, lastY;
    canvas.addEventListener("touchmove", async e => {
        e.preventDefault();
        if (e.touches.length !== 1) return;
        if (lastX && lastY) {
            renderer.offsetX = lerp(renderer.offsetX, renderer.offsetX + e.touches[0].clientX - lastX, .5);
            renderer.offsetY = lerp(renderer.offsetY, renderer.offsetY + e.touches[0].clientY - lastY, .5);
        }
        lastX = e.touches[0].clientX;
        lastY = e.touches[0].clientY;
        await renderer.renderAll();
    });
    canvas.addEventListener("touchend", () => {
        lastX = undefined;
        lastY = undefined;
    });

    canvas.addEventListener("touchstart", e => {
        if (e.touches.length !== 2) return;
        scaling = true;
    });

    canvas.addEventListener("touchmove", async e => {
        if (e.touches.length !== 2) return;
        const deltaX = e.touches[0].clientX - e.touches[1].clientX;
        const deltaY = e.touches[0].clientY - e.touches[1].clientY;

        const currDiff = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        const val = Math.abs(currDiff - prevDiff);

        if (prevDiff > 0 && val >= 10) {
            renderer.zoom = lerp(renderer.zoom, renderer.zoom + (currDiff > prevDiff ? 1 : -1) * 25, .02);
            await renderer.renderAll();
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

    const pixX = Math.floor((event.clientX - renderer.offsetX) / renderer.zoom), pixY = Math.floor((event.clientY - renderer.offsetY) / renderer.zoom);
    if (pixX < 0 || pixX >= width || pixY < 0 || pixY > height)
        return popup("You can't place pixels there!");

    socket.emit("mouseDown",
        pixX,
        pixY,
        hexToRgb(currentColor)
    );
}

createListeners();