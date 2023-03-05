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

window.addEventListener('resize', event => {
    canvas.width = canvas.getBoundingClientRect().width;
    canvas.height = canvas.getBoundingClientRect().height;
    setTimeout(() => {
        redrawAll();
    }, 1);
}, true);

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
    let longPressed = false;
    let scaling = false;
    let prevDiff = 0;
    document.querySelectorAll("div[class*='color-selector']:not(#colorpicker)")
        .forEach(x => x.addEventListener("click", e => selectColor(e)));

    document.getElementById("colorpicker").addEventListener("click", e => {
        const parent = document.getElementById("clr-parent");
        if (parent.children.length !== 0) {
            document.getElementById("clr-parent").innerHTML = "";
        } else {
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
        }
    });

    document.addEventListener("coloris:pick", e => {
        const s = hexToStr(e.detail.color);
        currentColor = `rgb(${s.r}, ${s.g}, ${s.b})`;
        document.getElementById("colorpicker").style.backgroundColor = currentColor;
    });

    canvas.addEventListener("wheel", e => {
        e.preventDefault();
        const zoom_x = canvas.getBoundingClientRect().width / (width * zoom);
        zoom = clamp(zoom - e.deltaY / 100, minZoom, maxZoom);
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
        longPressed = false;
        if (e.button !== 1)
            return;
        move = false;
    });

    canvas.addEventListener("long-press", e => {
        longPressed = true;
    });

    canvas.addEventListener("mousemove", e => {
        if (!move && !longPressed)
            return;

        offsetX += e.movementX;
        offsetY += e.movementY;
        redrawAll();
    });

    let lastX, lastY;
    canvas.addEventListener("touchmove", e => {
        e.preventDefault();
        if (e.touches.length !== 1)
            return
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
        if (window.location.search !== "?user=admin&userId=0" && timeout > Date.now() / 1000) {
            popup("Woah, slow down there! Wait till the timeout has worn off before you place a pixel again");
            return;
        }
    socket.emit("mouseDown",
        Math.floor((event.clientX - offsetX) / zoom),
        Math.floor((event.clientY - offsetY) / zoom),
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
    ctx.rect(x * zoom + offsetX, y * zoom + offsetY, zoom, zoom);
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

function hexToStr(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

function lerp(a, b, time) {
    return a * (1 - time) + b * time;
}

createListeners();
