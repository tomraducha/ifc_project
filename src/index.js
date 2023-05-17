import "./style.css";
import {
  AmbientLight,
  AxesHelper,
  DirectionalLight,
  GridHelper,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
// three-mesh-bvh
import { Raycaster, Vector2 } from "three";
import {
  acceleratedRaycast,
  computeBoundsTree,
  disposeBoundsTree,
} from "three-mesh-bvh";

import {
  IfcAPI,
  IFCSPACE,
  // IFCSENSOR,
  // IFCCLASSIFICATIONREFERENCE,
} from "web-ifc/web-ifc-api";

const ifcapi = new IfcAPI();

//Sets up the IFC loading
const ifcModels = [];
const raycaster = new Raycaster();
raycaster.firstHitOnly = true;
const mouse = new Vector2();

async function loadIFC() {
  await ifcLoader.ifcManager.setWasmPath("../../");
  ifcLoader.load("../../IFC/01.ifc", (ifcModel) => {
    ifcModels.push(ifcModel);
    scene.add(ifcModel);
  });
}

loadIFC();

//Creates the Three.js scene
const scene = new Scene();

//Object to store the size of the viewport
const size = {
  width: window.innerWidth,
  height: window.innerHeight,
};

//Creates the camera (point of view of the user)
const aspect = size.width / size.height;
const camera = new PerspectiveCamera(75, aspect);
camera.position.z = 15;
camera.position.y = 13;
camera.position.x = 8;

//Creates the lights of the scene
const lightColor = 0xffffff;

const ambientLight = new AmbientLight(lightColor, 0.5);
scene.add(ambientLight);

const directionalLight = new DirectionalLight(lightColor, 1);
directionalLight.position.set(0, 10, 0);
directionalLight.target.position.set(-5, 0, 0);
scene.add(directionalLight);
scene.add(directionalLight.target);

//Sets up the renderer, fetching the canvas of the HTML
const threeCanvas = document.getElementById("three-canvas");
const renderer = new WebGLRenderer({
  canvas: threeCanvas,
  alpha: true,
});

renderer.setSize(size.width, size.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

//Creates grids and axes in the scene
const grid = new GridHelper(50, 30);
scene.add(grid);

const axes = new AxesHelper();
axes.material.depthTest = false;
axes.renderOrder = 1;
scene.add(axes);

//Creates the orbit controls (to navigate the scene)
const controls = new OrbitControls(camera, threeCanvas);
controls.enableDamping = true;
controls.target.set(-2, 0, 0);

//Animation loop
const animate = () => {
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
};

animate();

//Adjust the viewport to the size of the browser
window.addEventListener("resize", () => {
  size.width = window.innerWidth;
  size.height = window.innerHeight;
  camera.aspect = size.width / size.height;
  camera.updateProjectionMatrix();
  renderer.setSize(size.width, size.height);
});

import { IFCLoader } from "web-ifc-three/IFCLoader";

let modelID = 0;
// Sets up the IFC loading
const ifcLoader = new IFCLoader();
ifcLoader.ifcManager.setupThreeMeshBVH(
  computeBoundsTree,
  disposeBoundsTree,
  acceleratedRaycast
);
ifcLoader.ifcManager.setWasmPath("../wasm/");
const input = document.getElementById("file-input");
input.addEventListener(
  "change",
  (changed) => {
    const file = changed.target.files[0];
    var ifcURL = URL.createObjectURL(file);
    initIfcApi(ifcURL);
    ifcLoader.load(ifcURL, (ifcModel) => {
      scene.add(ifcModel);
      console.log(ifcModel);
    });
  },
  false
);

/**
 * Requests the data from the url
 *
 * @param {string} url
 * @returns
 */
function getIfcFile(url) {
  return new Promise((resolve, reject) => {
    var oReq = new XMLHttpRequest();
    oReq.responseType = "arraybuffer";
    oReq.addEventListener("load", () => {
      resolve(new Uint8Array(oReq.response));
    });
    oReq.open("GET", url);
    oReq.send();
  });
}

/**
 * Gets the elements of the requested model
 *
 * @param {string} modelID The model ID
 * @param {string} model The model type to retrieve
 * @returns
 */
function getAllElements(modelID, model) {
  // Get all the propertyset lines in the IFC file
  let lines = ifcapi.GetLineIDsWithType(modelID, model);
  let lineSize = lines.size();
  let spaces = [];
  for (let i = 0; i < lineSize; i++) {
    // Getting the ElementID from Lines
    let relatedID = lines.get(i);
    // Getting Element Data using the relatedID
    let relDefProps = ifcapi.GetLine(modelID, relatedID);
    spaces.push(relDefProps);
  }
  return spaces;
}

/**
 * Initializes the ifcApi to request data.
 *
 * @param {string} ifcFileLocation
 */
function initIfcApi(ifcFileLocation) {
  ifcapi.Init().then(() => {
    getIfcFile(ifcFileLocation).then((ifcData) => {
      modelID = ifcapi.OpenModel(ifcData);
      let isModelOpened = ifcapi.IsModelOpen(modelID);
      console.log({ isModelOpened });
      let elements = getAllElements(modelID, IFCSPACE);
      console.log({ elements });
      ifcapi.CloseModel(modelID);
    });
  });
}

function cast(event) {
  // Computes the position of the mouse on the screen
  const bounds = threeCanvas.getBoundingClientRect();

  const x1 = event.clientX - bounds.left;
  const x2 = bounds.right - bounds.left;
  mouse.x = (x1 / x2) * 2 - 1;

  const y1 = event.clientY - bounds.top;
  const y2 = bounds.bottom - bounds.top;
  mouse.y = -(y1 / y2) * 2 + 1;

  // Places it on the camera pointing to the mouse
  raycaster.setFromCamera(mouse, camera);

  // Casts a ray
  return raycaster.intersectObjects(ifcModels);
}

// Event that gets executed when an item is picked
async function pick(event) {
  const found = cast(event)[0];
  if (found) {
    const index = found.faceIndex;
    const geometry = found.object.geometry;
    const ifc = ifcLoader.ifcManager;
    const id = ifc.getExpressId(geometry, index);
    const modelID = found.object.modelID;
    const props = await ifc.getItemProperties(modelID, id);
    const output = document.getElementById("output");
    output.innerHTML = JSON.stringify(props, null, 2);
  }
}

threeCanvas.addEventListener("dblclick", pick);
