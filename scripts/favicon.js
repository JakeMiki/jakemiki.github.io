const colorSchemeMedia = window.matchMedia("(prefers-color-scheme: light)");
const favicon = document.querySelector('link[rel="icon"]');

if ("addEventListener" in colorSchemeMedia) {
    colorSchemeMedia.addEventListener("change", changeFavicon);
} else if ("addListener" in colorSchemeMedia) {
    colorSchemeMedia.addListener(changeFavicon);
}

changeFavicon();

function changeFavicon() {
    if (colorSchemeMedia.matches) {
        favicon.href = "/assets/favicon-light.ico";
    } else {
        favicon.href = "/assets/favicon.ico";
    }
}
