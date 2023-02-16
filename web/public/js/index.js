import {io} from "https://cdn.socket.io/4.4.1/socket.io.esm.min.js";

const socket = io();

let radius = 20;
let currentColor = "rgb(217, 217, 217)";
let lastCached = [];
let offsetX = 0;
let offsetY = 0;

const canvas = document.getElementById("canvas");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const ctx = canvas.getContext("2d");

function selectColor(event) {
    currentColor = event.target.style.backgroundColor;
    console.log(currentColor);
}


socket.on("update", (data) => {
    lastCached.push(data);
    drawRect(data.x, data.y, data.color);
});
socket.on("updateAll", (data) => {
    lastCached = data;
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
            socket.emit("mouseDown", {
                "x": Math.floor(e.clientX / radius) - offsetX,
                "y": Math.floor(e.clientY / radius) - offsetY,
                "color": currentColor
            })

        if (e.button !== 1)
            return;
        move = false;
    });

    canvas.addEventListener("mousemove", e => {
        if (!move)
            return;

        offsetX += e.movementX / radius * 10;
        offsetY += e.movementY / radius * 10;
        redrawAll();
    });
}

function redrawAll() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid(radius);
    lastCached.forEach(shape => drawRect(shape.x, shape.y, shape.color));
}

function drawGrid(level) {
    let width = canvas.width;
    let height = canvas.height;
    console.log(canvas.width);
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

createListeners();