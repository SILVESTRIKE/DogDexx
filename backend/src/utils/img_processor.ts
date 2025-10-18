import sharp from "sharp";
import { Tensor } from "onnxruntime-node";

const MODEL_INPUT_SIZE = 224;

export async function imageToTensor(imageBuffer: Buffer): Promise<Tensor> {
  const resizedImageBuffer = await sharp(imageBuffer)
    .resize(MODEL_INPUT_SIZE, MODEL_INPUT_SIZE, { fit: "fill" })
    .toFormat("jpeg")
    .raw()
    .toBuffer();

  const float32Data = new Float32Array(MODEL_INPUT_SIZE * MODEL_INPUT_SIZE * 3);
  for (let i = 0; i < resizedImageBuffer.length; i++) {
    float32Data[i] = resizedImageBuffer[i];
  }

  const tensorShape: readonly number[] = [
    1,
    MODEL_INPUT_SIZE,
    MODEL_INPUT_SIZE,
    3,
  ];
  return new Tensor("float32", float32Data, tensorShape);
}
