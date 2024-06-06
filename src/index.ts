/* CSCI 4262 Assignment 3,
 * Author: Evan Suma Rosenberg
 * License: Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International
 */ 

import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { Color3, Vector3 } from "@babylonjs/core/Maths/math";
import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { PointerEventTypes, PointerInfo } from "@babylonjs/core/Events/pointerEvents";
import { WebXRDefaultExperience, WebXRManagedOutputCanvasOptions } from "@babylonjs/core/XR";
import { WebXRInputSource } from "@babylonjs/core/XR/webXRInputSource";

// Side effects
import "@babylonjs/loaders/glTF/2.0/glTFLoader"
import "@babylonjs/core/Helpers/sceneHelpers";
import "@babylonjs/inspector"
import { AssetsManager, DirectionalLight, HemisphericLight, HighlightLayer, Mesh, MeshBuilder, SceneLoader, TransformNode } from "@babylonjs/core";


// Note: The structure has changed since previous assignments because we need to handle the 
// async methods used for setting up XR. In particular, "createDefaultXRExperienceAsync" 
// needs to load models and create various things.  So, the function returns a promise, 
// which allows you to do other things while it runs.  Because we don't want to continue
// executing until it finishes, we use "await" to wait for the promise to finish. However,
// await can only run inside async functions. https://javascript.info/async-await
class Game 
{ 
    private canvas: HTMLCanvasElement;
    private engine: Engine;
    private scene: Scene;
    private currSelectedItem: Mesh | undefined
    private minPosX: number;
    private maxPosX: number;

    constructor()
    {
        // Get the canvas element 
        this.canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;

        // Generate the BABYLON 3D engine
        this.engine = new Engine(this.canvas, true); 

        // Creates a basic Babylon Scene object
        this.scene = new Scene(this.engine);   

        this.minPosX = -35; // Define minimum x position
        this.maxPosX = 35;  // Define maximum x position
    }

    start() : void
    {
        this.createScene().then(() => {
            // Register a render loop to repeatedly render the scene
            this.engine.runRenderLoop(() => { 
                this.scene.render();
            });

            // Watch for browser/canvas resize events
            window.addEventListener("resize", () => { 
                this.engine.resize();
            });
        });
    }

    private async createScene()
    {
        // create and position a first-person camera (non-mesh)
        var camera = new UniversalCamera("camera1", new Vector3(6, 1.6, 0), this.scene);
        camera.position = new Vector3(2,2.6,6)
        camera.rotation.y = Math.PI
        camera.fov = 90 * Math.PI / 180;

        camera.attachControl(this.canvas, true);
        camera.ellipsoid = new Vector3(1,1,1);
        camera.checkCollisions = true;
        this.scene.collisionsEnabled = true;

        // There is a bug in Babylon 4.1 that fails to enable the highlight layer on the Oculus Quest. 
        // This workaround fixes the problem.
        var canvasOptions = WebXRManagedOutputCanvasOptions.GetDefaults();
        canvasOptions.canvasOptions!.stencil = true;

        // Creates the XR experience helper
        const xrHelper = await this.scene.createDefaultXRExperienceAsync({outputCanvasOptions: canvasOptions});
        const hLayer = new HighlightLayer("h1Layer", this.scene)

        this.scene.onPointerObservable.add((pointerInfo) => {
            this.processPointer(pointerInfo, hLayer)
        })

        // Register event handler when controllers are added
        xrHelper.input.onControllerAddedObservable.add((controller) => {
            this.onControllerAdded(controller);
        });

        // Register event handler when controllers are removed
        xrHelper.input.onControllerRemovedObservable.add((controller) => {
            this.onControllerRemoved(controller);
        });

        // create scene
        this.createLights();
        this.createAssets(xrHelper);
    }

    private createAssets(xrHelper: WebXRDefaultExperience) {
        var assetsManager = new AssetsManager(this.scene);
        var worldTask = assetsManager.addMeshTask("world task", "", "assets\\", "VR_World.glb");
        worldTask.onSuccess = task => {
            worldTask.loadedMeshes[0].name = "world";
            worldTask.loadedMeshes.forEach((mesh) => {
                if(mesh.name.startsWith("Platform") || mesh.name.includes("Boat")){
                    xrHelper.teleportation.addFloorMesh(mesh)
                    mesh.position.x = Math.floor(Math.random() * 30) // generate a random number between 0 and 30
                }
                
            })

            worldTask.loadedMeshes.forEach(async(mesh) => {
                if(mesh.name.includes("Boat")){
                    await this.updateMeshPosition(mesh as Mesh, 0.1)
                } 
            })

            worldTask.loadedTransformNodes.forEach(async(node) => {
                if(node.name.includes("Car") || node.name.includes("car") || node.name.includes("Bus")){
                    if(!node.name.includes("repair")){
                        node.position.x = Math.floor(Math.random() * 30)
                        await this.updateTransformNodePosition(node, 0.4)
                    }

                }
            })
        }

        assetsManager.load();
        assetsManager.onFinish = (tasks) => {
            this.scene.debugLayer.show();
        };
        
    }   

    // Update method to handle mesh movement
    private async updateMeshPosition(mesh: Mesh, speed: number) {
        let moveDirection = 1
        if(mesh.name.includes("left") || mesh.name.includes("Left")){
            moveDirection = -1
        }

        while(true){
            await new Promise(resolve => {
                // Update mesh position based on movement direction
                mesh.position.x += speed * moveDirection;

                // Check if the mesh has reached the boundary
                if (mesh.position.x >= this.maxPosX || mesh.position.x <= this.minPosX) {
                    // Change movement direction when reaching the boundary
                    moveDirection *= -1;
                }

                setTimeout(resolve, 16)
            })

        }
    }

    private async updateTransformNodePosition(node: TransformNode, speed: number){
        let moveDirection = 1
        if(node.name.includes("left") || node.name.includes("Left")){
            moveDirection = -1
        }

        while(true){
            await new Promise(resolve => {
                // Update mesh position based on movement direction
                node.position.x += speed * moveDirection;

                // Check if the mesh has reached the boundary
                if (node.position.x >= this.maxPosX || node.position.x <= this.minPosX) {
                    // Change movement direction when reaching the boundary
                    moveDirection *= -1;
                }

                setTimeout(resolve, 16)
            })

        }
    }

    private createLights() {
        var light = new HemisphericLight("hemLight", new Vector3(0, 1, 0), this.scene);
        light.diffuse = new Color3(0.45, 0.89, 0.89);
        light.intensity = 1.5;

        // here comes the sun
        var dLight = new DirectionalLight("theSun", new Vector3(0, -0.23, 0.97), this.scene);
        dLight.position = new Vector3(5.31, 6.16, -30.20);
        dLight.diffuse = new Color3(0.79, 0.02, 0.12);
        dLight.intensity = 3;
    }

    // Event handler for processing pointer selection events
    private processPointer(pointerInfo: PointerInfo, hLayer: HighlightLayer)
    {
        switch (pointerInfo.type) {
            case PointerEventTypes.POINTERDOWN:
                break;
        }
    }

    // Event handler when controllers are added
    private onControllerAdded(controller : WebXRInputSource) {
        console.log("controller added: " + controller.pointer.name)
    }

    // Event handler when controllers are removed
    private onControllerRemoved(controller : WebXRInputSource) {
        console.log("controller removed: " + controller.pointer.name)
    }
}
/******* End of the Game class ******/   

// Start the game
var game = new Game();
game.start();
