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

function normalise(value, min, max) {
    return (value - min) / (max - min);
}

function remap(value, oMin, oMax, nMin, nMax) {
    return normalise(value, oMin, oMax) * (nMax - nMin) + nMin;
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

function arrayToRgb(cArray) {
    return toRgbString(cArray[0], cArray[1], cArray[2]);
}

function toRgbString(r, g, b) {
    return `rgb(${r}, ${g}, ${b})`;

}

function lerp(a, b, time) {
    return a * (1 - time) + b * time;
}