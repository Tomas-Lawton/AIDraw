const ws = new WebSocket("ws://localhost:8000/ws");
const localHost = "http://localhost:8000";

// Sketch
const canvas = document.getElementById("canvas");

// Exemplars
const canvas1 = document.getElementById("canvas1");
const canvas2 = document.getElementById("canvas2");
const canvas3 = document.getElementById("canvas3");
const canvas4 = document.getElementById("canvas4");

// Main UI
const prompt = document.getElementById("messageText");
const modal = document.getElementById("modal");
const controlPanel = document.getElementById("control-panel");
const buttonPanel = document.getElementById("button-panel");
const artControls = document.getElementById("art-panel");
const penControls = document.getElementById("pen-controls");
const selectControls = document.getElementById("select-controls");
const message = document.getElementById("message");
const drawButton = document.getElementById("draw");
const continueButton = document.getElementById("continue");
const palette = document.getElementById("palette");
const timeKeeper = document.getElementById("time-slider");
const lossText = document.getElementById("rolling-loss");
const setTraces = document.getElementById("num-traces");
const selectDot = document.getElementById("contain-pen-dot");

// Select UI
const deleteHandler = document.getElementById("delete-handler");
const rotateHandler = document.getElementById("rotate-handler");

// Default draw settings
let strokeColor = "#181818";
let strokeWidth = 12;
let opacity = 0.99; //ink feel
let penMode = "pen";
let clipDrawing = false;
let buttonControlLeft = true;
let showTraces = true;
let step = 1;
let myPath,
    regionPath,
    drawRegion,
    currentSelectedPath,
    lastRender,
    lastPrompt,
    erasePath,
    tmpGroup,
    mask,
    isFirstIteration,
    lastRollingLoss,
    traces,
    boundingBox;
let undoStack = [];
let redoStack = [];
let historyHolder = [];

// Setup
paper.install(window);
const scope = new PaperScope();
// const scope1 = new PaperScope();
// const scope2 = new PaperScope();
// const scope3 = new PaperScope();

scope.setup(canvas);
// scope1.setup(canvas1);
// scope2.setup(canvas2);
// scope3.setup(canvas3);

// scope.activate();
// scope1.activate();
// scope2.activate();
// scope3.activate();

const userLayer = new Layer(); //for drawing + erase mask
timeKeeper.style.width = "0";

const multiTool = new Tool();
multiTool.minDistance = 5;
const eraseTool = new Tool();
eraseTool.minDistance = 10;