const socketLight = document.querySelector(".socket-connect");

// General UI
const prompt = document.getElementById("messageText");
const modal = document.getElementById("modal");
const controlPanel = document.querySelector(".control-panel");
const controlDrawer = document.querySelector(".control-drawer");
const sketchBook = document.getElementById("sketchbook-panel");
const message = document.getElementById("message");
const palette = document.getElementById("palette");
const timeKeeper = document.getElementById("time-slider");
const localPrompts = document.getElementById("local-prompts");
// const lossText = document.getElementById("rolling-loss");
const setTraces = document.getElementById("num-traces");
const selectDot = document.getElementById("contain-pen-dot");
const alphaSlider = document.getElementById("alpha-slider");
const widthSlider = document.getElementById("width-slider");

const stopButton = document.getElementById("stop");
const focusButton = document.getElementById("focus");
const buttonPanel = document.querySelector(".action");
const dropdown = document.getElementById("pen-dropdown");
const aiMessage = document.getElementById("message");
const staticSketches = document.getElementById("static-sketches");
const explorer = document.getElementById("explore-sketches");
const sketchGrid = document.getElementById("grid-container");
const pen = document.getElementById("pen");
// Actions
const actionControls = document.querySelectorAll(".action-button");
const aiCard = document.getElementById("describe-card");
// Selected UI
const deleteHandler = document.getElementById("delete-handler");
const rotateSlider = document.getElementById("rotate-slider");
const copyHandler = document.getElementById("copy-handler");
const rotateNumber = document.getElementById("rotate-number");
const fixedHandler = document.getElementById("fixed-handler");
const scaleSlider = document.getElementById("scale-slider");
const scaleNumber = document.getElementById("scale-number");
const moveUp = document.getElementById("moveUp");
const sendToBack = document.getElementById("toBack");
const transformControl = document.getElementById("transform-ui");

const controllerUI = document.querySelectorAll(".inactive-section");
const sketchTemplate = document.getElementById("sketch-template");
const eyeDropper = document.getElementById("dropper");

const styles = document.querySelector(".draw-tools");
const penTool = document.querySelector(".pen-tool");
const eraseTool = document.querySelector(".erase-tool");
const selectTool = document.querySelector(".pointer-tool");
const toolToggle = document.querySelector(".style-window-toggle");
const toolWindow = document.querySelector(".tool-view");

const accordionItem = document.querySelector(".accordion-item");
const header = document.querySelector(".accordion-item-header");
const body = document.querySelector(".accordion-item-body");

const undoButton = document.querySelector(".undo");
const redoButton = document.querySelector(".redo");

const pickerSelect = document.getElementById("picker-ui");

const respectSlider = document.getElementById("respect-slider");

const sparkCanvas = document.querySelector(".sparkline");

const hint = document.querySelector(".hint-text");

// Sketching UI
const canvasFrame = document.querySelector(".canvas-frame");
const containerRect = canvasFrame.getBoundingClientRect();
const padding = parseInt(window.getComputedStyle(canvasFrame).padding);
const canvas = document.getElementById("canvas");
canvas.width = window.innerHeight - padding * 2 - 30;
canvas.height = window.innerHeight - padding * 2 - 30;
canvasFrame.style.top = window.innerHeight - canvasFrame.clientHeight + "px";
const frameOutline = Math.min(canvas.width, canvas.height);
const sketchContainer = document.getElementById("canvas-drop");
const canvasBounds = canvas.getBoundingClientRect();

const sketchSize = 130;
const scaleRatio = frameOutline / 224;
const fullMiniRatio = frameOutline / sketchSize;

const reusableExemplar = sketchTemplate.cloneNode(true); //clone to use
sketchTemplate.remove();

canvasFrame.firstElementChild.style.left =
    canvas.offsetParent.offsetLeft + "px";
// canvasFrame.firstElementChild.style.top =
//     window.innerHeight +
//     // canvasBounds.height -
//     canvasFrame.firstElementChild.offsetHeight +
//     "px";

canvasFrame.firstElementChild.style.top =
    padding - canvasFrame.firstElementChild.offsetHeight + "px";