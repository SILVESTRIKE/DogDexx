import { Response } from 'express';
import { Stream } from 'stream';

interface SendFileOptions {
  res: Response;
  fileName: string;
  contentType: string;
  data: Buffer | Stream;
}

export const sendFileToClient = (options: SendFileOptions): void => {
  const { res, fileName, contentType, data } = options;

  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

  if (data instanceof Stream) {
    data.pipe(res);
  } else {
    res.send(data);
  }
};