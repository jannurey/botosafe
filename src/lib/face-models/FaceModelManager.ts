import * as tf from "@tensorflow/tfjs";
import "@tensorflow/tfjs-backend-webgl";
import type * as FaceAPI from "@vladmandic/face-api";

class FaceModelManager {
  private static instance: FaceModelManager;
  private modelsLoaded = false;
  private loadingPromise: Promise<void> | null = null;
  private faceapi: typeof FaceAPI | null = null;

  private constructor() {}

  static getInstance(): FaceModelManager {
    if (!FaceModelManager.instance) {
      FaceModelManager.instance = new FaceModelManager();
    }
    return FaceModelManager.instance;
  }

  async loadFaceApi(): Promise<typeof FaceAPI> {
    if (this.faceapi) {
      return this.faceapi;
    }
    
    this.faceapi = await import("@vladmandic/face-api");
    return this.faceapi;
  }

  async loadModels(): Promise<void> {
    // If models are already loaded, return immediately
    if (this.modelsLoaded) {
      return;
    }

    // If models are currently loading, return the existing promise
    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    // Create a new loading promise
    this.loadingPromise = this.loadModelsInternal();
    await this.loadingPromise;
  }

  private async loadModelsInternal(): Promise<void> {
    try {
      // Initialize TensorFlow
      await tf.ready();
      try {
        await tf.setBackend("webgl");
      } catch {
        await tf.setBackend("cpu");
      }

      // Load face-api if not already loaded
      if (!this.faceapi) {
        await this.loadFaceApi();
      }

      // Load models from local directory
      const MODEL_URL = "/models";
      await Promise.all([
        this.faceapi!.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        this.faceapi!.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        this.faceapi!.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);

      this.modelsLoaded = true;
    } catch (error) {
      console.error("Failed to load face models:", error);
      this.loadingPromise = null; // Reset loading promise on failure
      throw error;
    }
  }

  areModelsLoaded(): boolean {
    return this.modelsLoaded;
  }

  getFaceApi(): typeof FaceAPI | null {
    return this.faceapi;
  }

  // Method to dispose of models and reset state (optional)
  dispose(): void {
    this.modelsLoaded = false;
    this.loadingPromise = null;
    // Note: face-api.js doesn't provide explicit model disposal methods
    // TensorFlow cleanup can be done separately if needed
  }
}

export default FaceModelManager.getInstance();