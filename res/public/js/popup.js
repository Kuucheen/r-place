function popup(text) {
    const div = document.createElement("div");
    div.innerText = text;
    div.classList.add("popup");
    document.getElementById("popup-container").append(div);
    setTimeout(() => document.body.removeChild(div), 6000);
}