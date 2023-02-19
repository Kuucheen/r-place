import {io} from "https://cdn.socket.io/4.4.1/socket.io.esm.min.js";

const socket = io();

let radius = 20;
let currentColor = "rgb(217, 217, 217)";
let offsetX = 0;
let offsetY = 0;
let imageCache = [];
let width = 1000, height = 1000;

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

function selectColor(event) {
    currentColor = event.target.style.backgroundColor;
    console.log(currentColor);
}


socket.on("update", (x, y, colorArr) => {
    const i = (x * width + y) * 4;
    imageCache[i] = colorArr[0];
    imageCache[i + 1] = colorArr[1];
    imageCache[i + 2] = colorArr[2];
    redrawAll();
});
socket.on("updateAll", buffer => {
    console.log(buffer);
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
        if (!move)
            socket.emit("mouseDown",
                Math.floor(e.clientX / radius) - offsetX,
                Math.floor(e.clientY / radius) - offsetY,
                hexToRgb(currentColor)
            )

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

function redrawAll() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    //drawGrid(radius);
    for (let i = 0; i < window.innerWidth / radius; i++) {
        for (let j = 0; j < window.innerHeight / radius; j++) {
            drawRect(i * radius, j * radius, getPixel(i + offsetX / radius, j + offsetY / radius))
        }
    }
}

function getPixel(x, y) {
    const i = (x * width + y) * 4;
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
    ctx.rect(x, y, radius, radius);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.closePath();
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16)
    ] : [0, 0, 0];
}


createListeners();