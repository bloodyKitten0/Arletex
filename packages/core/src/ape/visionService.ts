// VisionService – stub embodiment sensor (vision)
// Returns randomised visual perception data to simulate sensory input.

export interface VisionPercept {
  brightness: number;      // 0–1
  dominantColor: string;   // CSS hex
  motionDetected: boolean;
  faceCount: number;       // 0–5
}

const HEX_PALETTE = ['#FF5733', '#33FF57', '#3357FF', '#F3FF33', '#FF33F3', '#33FFF3'];

export class VisionService {
  /**
   * Simulate capturing a video frame.
   */
  perceive(): VisionPercept {
    return {
      brightness: Math.random(),
      dominantColor: HEX_PALETTE[Math.floor(Math.random() * HEX_PALETTE.length)] as string,
      motionDetected: Math.random() > 0.5,
      faceCount: Math.floor(Math.random() * 6),
    };
  }
}
