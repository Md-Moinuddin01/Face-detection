const videoFeed = document.getElementById("videoFeed");
const emptyState = document.getElementById("emptyState");
const loader = document.getElementById("loader");
const statusBadge = document.getElementById("statusBadge");
const message = document.getElementById("message");
const capturedImage = document.getElementById("capturedImage");

const fpsText = document.getElementById("fps");
const facesText = document.getElementById("faces");
const confidenceText = document.getElementById("confidence");
const clockText = document.getElementById("clock");

const openCameraBtn = document.getElementById("openCameraBtn");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const captureBtn = document.getElementById("captureBtn");

let statsTimer = null;

function showLoader(show) {
    loader.classList.toggle("hidden", !show);
}

function updateStatus(cameraStatus) {
    statusBadge.textContent = cameraStatus;

    if (cameraStatus === "Camera Active") {
        statusBadge.classList.remove("off");
        statusBadge.classList.add("on");
    } else {
        statusBadge.classList.remove("on");
        statusBadge.classList.add("off");
    }
}

function openCamera() {
    showLoader(true);
    emptyState.style.display = "none";
    videoFeed.style.display = "block";
    videoFeed.src = `/video_feed?time=${Date.now()}`;

    videoFeed.onload = () => {
        showLoader(false);
        updateStatus("Camera Active");
        message.textContent = "Camera opened successfully.";
    };

    setTimeout(() => showLoader(false), 1200);
}

async function callApi(url, successText) {
    try {
        const response = await fetch(url);
        const data = await response.json();
        message.textContent = data.message || successText;

        if (data.status) {
            updateStats(data.status);
        }

        return data;
    } catch (error) {
        message.textContent = "Something went wrong. Please check Flask server.";
        console.log(error);
    }
}

function updateStats(stats) {
    fpsText.textContent = stats.fps;
    facesText.textContent = stats.faces;
    confidenceText.textContent = `${stats.confidence}%`;
    updateStatus(stats.camera);
}

async function startDetection() {
    openCamera();
    await callApi("/start", "Detection started");
    startStatsTimer();
}

async function stopDetection() {
    await callApi("/stop", "Detection stopped");
    videoFeed.removeAttribute("src");
    videoFeed.style.display = "none";
    emptyState.style.display = "block";
    updateStatus("Camera Off");
    stopStatsTimer();
    updateStats({ fps: 0, faces: 0, confidence: 0, camera: "Camera Off" });
}

async function captureImage() {
    const data = await callApi("/capture", "Image captured");

    if (data && data.image) {
        capturedImage.src = `${data.image}?time=${Date.now()}`;
        capturedImage.style.display = "block";
    }
}

function startStatsTimer() {
    if (statsTimer) {
        return;
    }

    statsTimer = setInterval(async () => {
        const response = await fetch("/stats");
        const stats = await response.json();
        updateStats(stats);
    }, 700);
}

function stopStatsTimer() {
    clearInterval(statsTimer);
    statsTimer = null;
}

function updateClock() {
    const now = new Date();
    clockText.textContent = now.toLocaleTimeString();
}

openCameraBtn.addEventListener("click", openCamera);
startBtn.addEventListener("click", startDetection);
stopBtn.addEventListener("click", stopDetection);
captureBtn.addEventListener("click", captureImage);

setInterval(updateClock, 1000);
updateClock();
