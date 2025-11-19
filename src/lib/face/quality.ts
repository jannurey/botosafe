import type * as FaceAPI from "@vladmandic/face-api";

export interface FaceQuality {
  lighting: number;      // 0-100
  sharpness: number;     // Blur detection 0-100
  faceSize: number;      // Face area in pixels
  poseAngle: number;     // Degrees from frontal (0-90)
  confidence: number;    // Detection confidence 0-1
  overallScore: number;  // Combined quality score 0-100
  passed: boolean;       // Whether all quality checks pass
  issues: string[];      // List of quality issues
}

export interface QualityThresholds {
  minLighting: number;
  maxLighting: number;
  minSharpness: number;
  minFaceSize: number;
  maxPoseAngle: number;
  minConfidence: number;
}

const DEFAULT_THRESHOLDS: QualityThresholds = {
  minLighting: 50,
  maxLighting: 200,
  minSharpness: 40,
  minFaceSize: 10000, // pixels (approx 100x100)
  maxPoseAngle: 25,   // degrees
  minConfidence: 0.7,
};

/**
 * Calculate lighting quality from video element
 */
export function analyzeLighting(video: HTMLVideoElement): { score: number; message: string } {
  try {
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      return { score: 100, message: "Optimal lighting" };
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return { score: 100, message: "Optimal lighting" };

    canvas.width = video.videoWidth / 4;
    canvas.height = video.videoHeight / 4;
    
    if (canvas.width === 0 || canvas.height === 0) {
      return { score: 100, message: "Optimal lighting" };
    }
    
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    let totalBrightness = 0;
    let validPixels = 0;
    
    for (let i = 0; i < data.length; i += 16) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
      if (brightness > 10 && brightness < 245) {
        totalBrightness += brightness;
        validPixels++;
      }
    }
    
    const averageBrightness = validPixels > 0 ? totalBrightness / validPixels : 127;
    const score = Math.round((averageBrightness / 255) * 100);
    
    let message = "";
    if (averageBrightness < 50) {
      message = "Too dark. Move to a brighter area.";
    } else if (averageBrightness > 200) {
      message = "Too bright. Reduce glare or move away from direct light.";
    } else if (averageBrightness < 70) {
      message = "A bit dark. Move closer to a light source.";
    } else if (averageBrightness > 180) {
      message = "A bit bright. Reduce direct lighting on your face.";
    } else {
      message = "Optimal lighting conditions";
    }
    
    return { score, message };
  } catch (error) {
    console.error("Lighting analysis error:", error);
    return { score: 100, message: "Optimal lighting" };
  }
}

/**
 * Calculate blur/sharpness using Laplacian variance
 */
export function calculateSharpness(video: HTMLVideoElement): number {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return 100;

    canvas.width = video.videoWidth / 4;
    canvas.height = video.videoHeight / 4;
    
    if (canvas.width === 0 || canvas.height === 0) return 100;
    
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    // Convert to grayscale and apply Laplacian
    let laplacianSum = 0;
    let count = 0;
    
    for (let y = 1; y < canvas.height - 1; y++) {
      for (let x = 1; x < canvas.width - 1; x++) {
        const idx = (y * canvas.width + x) * 4;
        const gray = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
        
        // Simple Laplacian kernel
        const top = 0.299 * data[idx - canvas.width * 4] + 0.587 * data[idx - canvas.width * 4 + 1] + 0.114 * data[idx - canvas.width * 4 + 2];
        const bottom = 0.299 * data[idx + canvas.width * 4] + 0.587 * data[idx + canvas.width * 4 + 1] + 0.114 * data[idx + canvas.width * 4 + 2];
        const left = 0.299 * data[idx - 4] + 0.587 * data[idx - 3] + 0.114 * data[idx - 2];
        const right = 0.299 * data[idx + 4] + 0.587 * data[idx + 5] + 0.114 * data[idx + 6];
        
        const laplacian = Math.abs(4 * gray - top - bottom - left - right);
        laplacianSum += laplacian * laplacian;
        count++;
      }
    }
    
    const variance = count > 0 ? laplacianSum / count : 0;
    // Normalize to 0-100 scale (variance typically 0-10000)
    return Math.min(100, Math.round(variance / 100));
  } catch (error) {
    console.error("Sharpness calculation error:", error);
    return 100;
  }
}

/**
 * Calculate face pose angle from landmarks
 */
export function calculatePoseAngle(landmarks: FaceAPI.FaceLandmarks68): number {
  try {
    const positions = landmarks.positions;
    
    // Use key facial landmarks for pose estimation
    const noseTip = positions[30];      // Nose tip
    const leftEye = positions[36];      // Left eye outer corner
    const rightEye = positions[45];     // Right eye outer corner
    const leftMouth = positions[48];    // Left mouth corner
    const rightMouth = positions[54];   // Right mouth corner
    
    // Calculate horizontal symmetry (yaw)
    const eyeCenterX = (leftEye.x + rightEye.x) / 2;
    const mouthCenterX = (leftMouth.x + rightMouth.x) / 2;
    const faceWidth = Math.abs(rightEye.x - leftEye.x);
    
    // Deviation from center
    const yawDeviation = Math.abs(noseTip.x - eyeCenterX) / faceWidth;
    
    // Calculate vertical tilt (pitch)
    const eyeCenterY = (leftEye.y + rightEye.y) / 2;
    const faceHeight = Math.abs(mouthCenterX - eyeCenterY);
    const pitchDeviation = Math.abs(noseTip.y - eyeCenterY) / faceHeight;
    
    // Combined angle estimation (simplified)
    const angleEstimate = Math.max(yawDeviation, pitchDeviation) * 90;
    
    return Math.min(90, Math.round(angleEstimate));
  } catch (error) {
    console.error("Pose angle calculation error:", error);
    return 0;
  }
}

/**
 * Calculate face size from detection box
 */
export function calculateFaceSize(detection: FaceAPI.FaceDetection): number {
  const box = detection.box;
  return box.width * box.height;
}

/**
 * Comprehensive face quality assessment
 */
export function assessFaceQuality(
  video: HTMLVideoElement,
  detection: FaceAPI.WithFaceLandmarks<{ detection: FaceAPI.FaceDetection }>,
  thresholds: Partial<QualityThresholds> = {}
): FaceQuality {
  const config = { ...DEFAULT_THRESHOLDS, ...thresholds };
  const issues: string[] = [];
  
  // Lighting
  const lighting = analyzeLighting(video);
  const lightingScore = lighting.score;
  const lightingAvg = (lightingScore / 100) * 255;
  if (lightingAvg < config.minLighting) {
    issues.push("Too dark - move to brighter area");
  } else if (lightingAvg > config.maxLighting) {
    issues.push("Too bright - reduce direct light");
  }
  
  // Sharpness
  const sharpness = calculateSharpness(video);
  if (sharpness < config.minSharpness) {
    issues.push("Image too blurry - hold still");
  }
  
  // Face size
  const faceSize = calculateFaceSize(detection.detection);
  if (faceSize < config.minFaceSize) {
    issues.push("Face too small - move closer");
  }
  
  // Pose angle
  const poseAngle = calculatePoseAngle(detection.landmarks);
  if (poseAngle > config.maxPoseAngle) {
    issues.push("Face not centered - look straight ahead");
  }
  
  // Confidence
  const confidence = detection.detection.score;
  if (confidence < config.minConfidence) {
    issues.push("Low detection confidence - improve conditions");
  }
  
  // Calculate overall score (weighted average)
  const lightingNorm = Math.max(0, Math.min(100, lightingAvg < 127 ? lightingAvg / 127 * 100 : (255 - lightingAvg) / 128 * 100));
  const sharpnessNorm = Math.min(100, sharpness);
  const sizeNorm = Math.min(100, (faceSize / config.minFaceSize) * 50);
  const poseNorm = Math.max(0, 100 - (poseAngle / config.maxPoseAngle) * 100);
  const confidenceNorm = confidence * 100;
  
  const overallScore = Math.round(
    lightingNorm * 0.25 +
    sharpnessNorm * 0.20 +
    sizeNorm * 0.15 +
    poseNorm * 0.20 +
    confidenceNorm * 0.20
  );
  
  const passed = issues.length === 0;
  
  return {
    lighting: lightingScore,
    sharpness,
    faceSize,
    poseAngle,
    confidence,
    overallScore,
    passed,
    issues,
  };
}
