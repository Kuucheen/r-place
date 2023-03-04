const socket = io();

let radius = 30;
let currentColor = "rgb(217, 217, 217)";
let offsetX = 0;
let offsetY = 0;
let imageCache = [];
let width = 50, height = 50;
let timeout = Date.now() / 1000;
let lastSelected = document.querySelector("div[title=Pomodoro]");

const canvas = document.getElementById("canvas");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
const ctx = canvas.getContext("2d");

function post(path, params, method = 'post') {
    const form = document.createElement('form');
    form.method = method;
    form.action = path;

    for (const key in params) {
        if (params.hasOwnProperty(key)) {
            const hiddenField = document.createElement('input');
            hiddenField.type = 'hidden';
            hiddenField.name = key;
            hiddenField.value = params[key];

            form.appendChild(hiddenField);
        }
    }

    document.body.appendChild(form);
    form.submit();
}

function selectColor(event) {
    currentColor = event.target.style.backgroundColor;
    event.target.classList.add("active");
    lastSelected.classList.remove("active");
    lastSelected = event.target;
}

setInterval(() => {
    const leftTimeout = Math.max(0, timeout - Date.now() / 1000);
    const seconds = Math.floor(leftTimeout % 60);
    document.querySelector("div[class=pc-number]").innerText =
        `${Math.floor(leftTimeout / 60)}:${seconds < 10 ? "0" : ""}${seconds}`;
}, 1000);

socket.on("error", error => {
    if (error === "invalidHash") window.location.reload();
    else post("/error", {error});
});

socket.on("timeoutUpdated", t => {
    timeout = t;
});
socket.on("update", (x, y, colorArr) => {
    const i = (y * height + x) * 4;
    imageCache[i] = colorArr[0];
    imageCache[i + 1] = colorArr[1];
    imageCache[i + 2] = colorArr[2];
    redrawAll();
});
socket.on("updateAll", buffer => {
    imageCache = new Uint8Array(buffer);
    redrawAll();
});

function createListeners() {
    document.querySelectorAll("div[class='color-selector']")
        .forEach(x => x.addEventListener("click", e => selectColor(e)));

    canvas.addEventListener("wheel", e => {
        e.preventDefault();
        radius = clamp(radius - e.deltaY / 100, 30, 200);
        redrawAll();
    });
    let move = false;
    canvas.addEventListener("mousedown", e => {
        e.preventDefault();
        if (e.button !== 1)
            return;
        move = true;
    });
    canvas.addEventListener("mouseup", e => {
        e.preventDefault();
        if (!move) {
            placePixel(e);
        }
        if (e.button !== 1)
            return;
        move = false;
    });

    canvas.addEventListener("mousemove", e => {
        if (!move)
            return;

        offsetX += e.movementX;
        offsetY += e.movementY;
        redrawAll();
    });
}

function placePixel(event) {
    if (timeout > Date.now() / 1000) {
        popup("Woah, slow down there! Wait till the timeout has worn off before you place a pixel again");
        return;
    }
    drawRect(
        Math.floor((event.clientX - offsetX) / radius),
        Math.floor((event.clientY - offsetY) / radius),
        "rgb(100,100,100)"
    )
    socket.emit("mouseDown",
        Math.floor((event.clientX) / radius - offsetX),
        Math.floor((event.clientY) / radius - offsetY),
        hexToRgb(currentColor)
    )
}

function redrawAll() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < width; i++) {
        for (let j = 0; j < height; j++) {
            drawRect(i, j, getPixel(i, j))
        }
    }
    //drawGrid(radius);
}

function getPixel(x, y) {
    const i = (y * height + x) * 4;
    return `rgb(${imageCache[i]}, ${imageCache[i + 1]}, ${imageCache[i + 2]}`;
}

function drawGrid(level) {
    let width = canvas.width;
    let height = canvas.height;
    ctx.strokeStyle = "rgb(100, 100, 100)";
    for (let i = 0; i < width; i += level)
        ctx.strokeRect(i + offsetX % level, 0, 0, height);

    for (let i = 0; i < height; i += level)
        ctx.strokeRect(0, i + offsetY % level, width, 0);
}

function drawRect(x, y, color) {
    ctx.beginPath();
    ctx.rect(x * radius + offsetX, y * radius + offsetY, radius, radius);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.closePath();
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function hexToRgb(rgb) {
    return rgb.replace(/[^\d,]/g, '').split(',').map(x => parseInt(x));
}


createListeners();
popup("Hello World!");