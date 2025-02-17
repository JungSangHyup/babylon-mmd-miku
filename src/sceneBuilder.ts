// for use loading screen, we need to import following module.
import "@babylonjs/core/Loading/loadingScreen";
// for cast shadow, we need to import following module.
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
// for use WebXR we need to import following two modules.
import "@babylonjs/core/Helpers/sceneHelpers";
import "@babylonjs/core/Materials/Node/Blocks";
// if your model has .tga texture, uncomment following line.
// import "@babylonjs/core/Materials/Textures/Loaders/tgaTextureLoader";
// for load .bpmx file, we need to import following module.
// if you want to use .pmx file, uncomment following line.
import "babylon-mmd/esm/Loader/pmxLoader";
// if you want to use .pmd file, uncomment following line.
// import "babylon-mmd/esm/Loader/pmdLoader";
// for play `MmdAnimation` we need to import following two modules.
import "babylon-mmd/esm/Runtime/Animation/mmdRuntimeCameraAnimation";
import "babylon-mmd/esm/Runtime/Animation/mmdRuntimeModelAnimation";

import {
    ArcRotateCamera,
    Color3,
    Color4,
    DefaultRenderingPipeline,
    DepthOfFieldEffectBlurLevel,
    DirectionalLight,
    HavokPlugin,
    HemisphericLight,
    ImageProcessingConfiguration,
    Matrix,
    SceneLoader,
    ShadowGenerator,
    SSRRenderingPipeline,
    StandardMaterial,
    TransformNode
} from "@babylonjs/core";
import type {Engine} from "@babylonjs/core/Engines/engine";
import {Vector3} from "@babylonjs/core/Maths/math.vector";
import {Scene} from "@babylonjs/core/scene";
// eslint-disable-next-line @typescript-eslint/naming-convention
import HavocPhysics from "@babylonjs/havok";
import type {BpmxLoader, MmdMesh, MmdStandardMaterialBuilder} from "babylon-mmd";
import {
    BvmdLoader,
    MmdPhysics,
    MmdPlayerControl,
    MmdRuntime,
    PmxLoader,
    SdefInjector,
    StreamAudioPlayer
} from "babylon-mmd";
import {MmdCamera} from "babylon-mmd/esm/Runtime/mmdCamera";

import type {ISceneBuilder} from "./baseRuntime";

export class SceneBuilder implements ISceneBuilder {
    public async build(_canvas: HTMLCanvasElement, engine: Engine): Promise<Scene> {
        SdefInjector.OverrideEngineCreateEffect(engine);
        SceneLoader.RegisterPlugin(new PmxLoader());

        engine.displayLoadingUI();

        const bpmxLoader = SceneLoader.GetPluginForExtension(".bpmx") as BpmxLoader;
        bpmxLoader.loggingEnabled = true;
        const materialBuilder = bpmxLoader.materialBuilder as MmdStandardMaterialBuilder;
        materialBuilder.useAlphaEvaluation = false;
        // const alphaBlendMaterials = ["face02", "Facial02", "HL", "Hairshadow", "q302"];
        // const alphaTestMaterials = ["q301"];
        // materialBuilder.loadOutlineRenderingProperties = (material): void => {
        //     if (!alphaBlendMaterials.includes(material.name) && !alphaTestMaterials.includes(material.name)) return;
        //     material.transparencyMode = alphaBlendMaterials.includes(material.name)
        //         ? Material.MATERIAL_ALPHABLEND
        //         : Material.MATERIAL_ALPHATEST;
        //     material.useAlphaFromDiffuseTexture = true;
        //     material.diffuseTexture!.hasAlpha = true;

        const scene = new Scene(engine);
        scene.clearColor = new Color4(0.95, 0.95, 0.95, 1.0);
        scene.enablePhysics(new Vector3(0, -9.8 * 10, 0), new HavokPlugin(true, await HavocPhysics()));

        const mmdRoot = new TransformNode("mmdRoot", scene);
        mmdRoot.position.z -= 50;

        const mmdCamera = new MmdCamera("mmdCamera", new Vector3(0, 10, 0), scene);
        mmdCamera.maxZ = 5000;
        mmdCamera.parent = mmdRoot;

        const arcRotateCamera = new ArcRotateCamera("arcRotateCamera", 0, 0, 45, new Vector3(0, 10, 0), scene);
        arcRotateCamera.maxZ = 5000;
        arcRotateCamera.setPosition(new Vector3(0, 10, -45));
        arcRotateCamera.attachControl(_canvas, false);
        arcRotateCamera.inertia = 0.8;
        arcRotateCamera.speed = 10;

        const hemisphericLight = new HemisphericLight("HemisphericLight", new Vector3(0, 1, 0), scene);
        hemisphericLight.intensity = 0.3;
        hemisphericLight.specular.set(0, 0, 0);
        hemisphericLight.groundColor.set(1, 1, 1);

        const directionalLight = new DirectionalLight("directionalLight", new Vector3(0.5, -1, 1), scene);
        directionalLight.intensity = 0.7;
        directionalLight.autoCalcShadowZBounds = true;
        directionalLight.autoUpdateExtends = true;
        directionalLight.shadowMaxZ = 20;
        directionalLight.shadowMinZ = -20;
        directionalLight.orthoTop = 18;
        directionalLight.orthoBottom = -3;
        directionalLight.orthoLeft = -10;
        directionalLight.orthoRight = 10;
        directionalLight.shadowOrthoScale = 0;

        const shadowGenerator = new ShadowGenerator(1024, directionalLight, true);
        shadowGenerator.usePercentageCloserFiltering = true;
        shadowGenerator.forceBackFacesOnly = false;
        shadowGenerator.bias = 0.01;
        shadowGenerator.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
        shadowGenerator.frustumEdgeFalloff = 0.1;



        const ground = await SceneLoader.ImportMeshAsync(
            "ground",
            "res/stage/RedialC_EpRoomFuu Ver1.12/",
            "EPF.pmx", scene,
            (event) => engine.loadingUIText = `Loading model... ${event.loaded}/${event.total} (${Math.floor(event.loaded * 100 / event.total)}%)`)
            .then((result) => result.meshes[0] as MmdMesh);
        const groundMaterial = ground.material = new StandardMaterial("groundMaterial", scene);
        groundMaterial.diffuseColor = new Color3(1.02, 1.02, 1.02);
        ground.receiveShadows = true;

        const modelMesh = await SceneLoader.ImportMeshAsync(
            "",
            "res/model/",
            "YYB marshmallow miku.bpmx", scene,
            (event) => engine.loadingUIText = `Loading model... ${event.loaded}/${event.total} (${Math.floor(event.loaded * 100 / event.total)}%)`)
            .then((result) => result.meshes[0] as MmdMesh);
        for (const mesh of modelMesh.metadata.meshes) mesh.receiveShadows = true;
        shadowGenerator.addShadowCaster(modelMesh);

        const mmdRuntime = new MmdRuntime(scene,  new MmdPhysics(scene));
        mmdRuntime.register(scene);
        mmdRuntime.setCamera(mmdCamera);

        const audioPlayer = new StreamAudioPlayer(scene);
        audioPlayer.preservesPitch = false;
        audioPlayer.source = "res/music/melancholy_night.mp3";
        mmdRuntime.setAudioPlayer(audioPlayer);

        const mmdModel = mmdRuntime.createMmdModel(modelMesh);
        const bvmdLoader = new BvmdLoader(scene);
        const modelMotion = await bvmdLoader.loadAsync("model_motion_1",
            "res/animation/メランコリ・ナイト.bvmd"
        );
        const cameraMotion = await bvmdLoader.loadAsync("camera_motion_1",
            "res/animation/メランコリ・ナイト_カメラ.bvmd"
        );

        mmdModel.addAnimation(modelMotion);
        mmdModel.setAnimation("model_motion_1");

        mmdCamera.addAnimation(cameraMotion);
        mmdCamera.setAnimation("camera_motion_1");

        scene.onAfterRenderObservable.addOnce(() => engine.hideLoadingUI());

        const ssrRenderingPipeline = new SSRRenderingPipeline(
            "ssr",
            scene,
            [mmdCamera, arcRotateCamera],
            false
        );
        ssrRenderingPipeline.step = 32;
        ssrRenderingPipeline.maxSteps = 128;
        ssrRenderingPipeline.maxDistance = 500;
        ssrRenderingPipeline.enableSmoothReflections = false;
        ssrRenderingPipeline.enableAutomaticThicknessComputation = false;
        ssrRenderingPipeline.blurDownsample = 2;
        ssrRenderingPipeline.ssrDownsample = 2;
        ssrRenderingPipeline.thickness = 0.1;
        ssrRenderingPipeline.selfCollisionNumSkip = 2;
        ssrRenderingPipeline.blurDispersionStrength = 0;
        ssrRenderingPipeline.roughnessFactor = 0.1;
        ssrRenderingPipeline.reflectivityThreshold = 0.9;
        ssrRenderingPipeline.samples = 4;

        const defaultPipeline = new DefaultRenderingPipeline("default", true, scene, [mmdCamera, arcRotateCamera]);
        defaultPipeline.samples = 4;
        defaultPipeline.bloomEnabled = true;
        defaultPipeline.chromaticAberrationEnabled = true;
        defaultPipeline.chromaticAberration.aberrationAmount = 1;
        defaultPipeline.depthOfFieldEnabled = true;
        defaultPipeline.depthOfFieldBlurLevel = DepthOfFieldEffectBlurLevel.Low;
        defaultPipeline.fxaaEnabled = true;
        defaultPipeline.imageProcessingEnabled = true;
        defaultPipeline.imageProcessing.toneMappingEnabled = true;
        defaultPipeline.imageProcessing.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
        defaultPipeline.imageProcessing.vignetteWeight = 0.5;
        defaultPipeline.imageProcessing.vignetteStretch = 0.5;
        defaultPipeline.imageProcessing.vignetteColor = new Color4(0, 0, 0, 0);
        defaultPipeline.imageProcessing.vignetteEnabled = true;

        defaultPipeline.depthOfField.fStop = 100;
        defaultPipeline.depthOfField.focalLength = 500;

        const rotationMatrix = new Matrix();
        const cameraNormal = new Vector3();
        const cameraEyePosition = new Vector3();
        const headRelativePosition = new Vector3();

        scene.onBeforeRenderObservable.add(() => {
            const cameraRotation = mmdCamera.rotation;
            Matrix.RotationYawPitchRollToRef(-cameraRotation.y, -cameraRotation.x, -cameraRotation.z, rotationMatrix);

            Vector3.TransformNormalFromFloatsToRef(0, 0, 1, rotationMatrix, cameraNormal);

            mmdCamera.position.addToRef(
                Vector3.TransformCoordinatesFromFloatsToRef(0, 0, mmdCamera.distance, rotationMatrix, cameraEyePosition),
                cameraEyePosition
            );

            defaultPipeline.depthOfField.focusDistance = (Vector3.Dot(headRelativePosition, cameraNormal) / Vector3.Dot(cameraNormal, cameraNormal)) * 1000;
        });

        let lastClickTime = -Infinity;
        _canvas.onclick = (): void => {
            const currentTime = performance.now();
            if (500 < currentTime - lastClickTime) {
                lastClickTime = currentTime;
                return;
            }

            lastClickTime = -Infinity;

            if (scene.activeCamera === mmdCamera) {
                scene.activeCamera = arcRotateCamera;
                mmdRuntime.pauseAnimation();
            } else {
                scene.activeCamera = mmdCamera;
                mmdRuntime.playAnimation();
            }
        };
        const mmdPlayerControl = new MmdPlayerControl(scene, mmdRuntime, audioPlayer);
        mmdPlayerControl.showPlayerControl();

        return scene;
    }
}
