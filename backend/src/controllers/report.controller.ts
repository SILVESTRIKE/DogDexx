// import { Request, Response, NextFunction } from 'express';
// import { ReportService } from '../services/report.service';
// import { sendFileToClient } from '../utils/file.util';
// import { BadRequestError } from '../errors';
// import { format } from 'date-fns';

// const reportService = new ReportService();

// export const exportReport = async (req: Request, res: Response, next: NextFunction) => {
//   try {
//     const { startDate, endDate, format: formatType } = req.query as { startDate?: string, endDate?: string, format?: 'excel' | 'word' };

//     if (!startDate || !endDate || !formatType) {
//       throw new BadRequestError('Vui lòng cung cấp startDate, endDate và format (excel/word).');
//     }

//     const range = { startDate: new Date(startDate), endDate: new Date(endDate) };
//     let fileBuffer: Buffer;
//     let fileName: string;
//     let contentType: string;

//     const dateSuffix = format(new Date(), 'yyyy-MM-dd');

//     if (formatType === 'excel') {
//       fileBuffer = await reportService.generateExcelReport(range);
//       fileName = `DogDex_Report_${dateSuffix}.xlsx`;
//       contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
//     } else if (formatType === 'word') {
//       fileBuffer = await reportService.generateWordReport(range);
//       fileName = `DogDex_Report_${dateSuffix}.docx`;
//       contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
//     } else {
//       throw new BadRequestError('Định dạng file không được hỗ trợ.');
//     }

//     sendFileToClient({ res, fileName, contentType, data: fileBuffer });

//   } catch (error) {
//     next(error);
//   }
// };