import { UserModel } from '../models/user.model';
import { PredictionHistoryModel } from '../models/prediction_history.model';
import { FeedbackModel } from '../models/feedback.model';
import { PlanModel } from '../models/plan.model';
import * as ExcelJS from 'exceljs';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType } from 'docx';

export interface ReportDateRange {
  startDate: Date;
  endDate: Date;
}

export class ReportService {
  /**
   * Lấy dữ liệu báo cáo tổng hợp.
   */
  private async getReportData(range: ReportDateRange) {
    const { startDate, endDate } = range;

    const [
      totalUsers,
      newUsers,
      totalPredictions,
      totalFeedbacks,
      approvedFeedbacks,
      topBreeds,
      usersByPlan,
    ] = await Promise.all([
      UserModel.countDocuments({ isDeleted: false, createdAt: { $lte: endDate } }),
      UserModel.countDocuments({ isDeleted: false, createdAt: { $gte: startDate, $lte: endDate } }),
      PredictionHistoryModel.countDocuments({ createdAt: { $gte: startDate, $lte: endDate } }),
      FeedbackModel.countDocuments({ createdAt: { $gte: startDate, $lte: endDate } }),
      FeedbackModel.countDocuments({ status: 'approved_for_training', createdAt: { $gte: startDate, $lte: endDate } }),
      PredictionHistoryModel.aggregate([
        { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
        { $unwind: '$predictions' },
        { $group: { _id: '$predictions.class', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
        { $project: { breed: '$_id', count: 1, _id: 0 } },
      ]),
      UserModel.aggregate([
        { $match: { isDeleted: false } },
        { $group: { _id: '$plan', count: { $sum: 1 } } },
        { $lookup: { from: 'plans', localField: '_id', foreignField: 'slug', as: 'planDetails' } },
        { $project: { planName: { $ifNull: [{ $arrayElemAt: ['$planDetails.name', 0] }, '$_id'] }, count: 1, _id: 0 } }
      ])
    ]);

    const accuracy = totalFeedbacks > 0 ? (approvedFeedbacks / totalFeedbacks) * 100 : 0;

    return {
      summary: {
        newUsers,
        totalUsers,
        totalPredictions,
        totalFeedbacks,
        accuracy: parseFloat(accuracy.toFixed(2)),
      },
      details: {
        topBreeds,
        usersByPlan,
      }
    };
  }

  /**
   * Tạo báo cáo dưới dạng file Excel.
   */
  public async generateExcelReport(range: ReportDateRange): Promise<ExcelJS.Buffer> {
    const data = await this.getReportData(range);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'DogDex AI';
    workbook.created = new Date();

    // Sheet Tổng quan
    const summarySheet = workbook.addWorksheet('Tổng quan');
    summarySheet.columns = [
      { header: 'Chỉ số', key: 'metric', width: 30 },
      { header: 'Giá trị', key: 'value', width: 20 },
    ];
    summarySheet.addRow({ metric: 'Người dùng mới', value: data.summary.newUsers });
    summarySheet.addRow({ metric: 'Tổng số người dùng (cuối kỳ)', value: data.summary.totalUsers });
    summarySheet.addRow({ metric: 'Tổng lượt dự đoán', value: data.summary.totalPredictions });
    summarySheet.addRow({ metric: 'Tổng lượt phản hồi', value: data.summary.totalFeedbacks });
    summarySheet.addRow({ metric: 'Tỷ lệ chính xác (từ Feedback)', value: `${data.summary.accuracy}%` });

    // Sheet Chi tiết
    const detailSheet = workbook.addWorksheet('Chi tiết');
    detailSheet.addTable({
        name: 'TopBreeds',
        ref: 'A1',
        headerRow: true,
        columns: [{ name: 'Giống chó' }, { name: 'Số lượt dự đoán' }],
        rows: data.details.topBreeds.map(b => [b.breed, b.count]),
    });
    detailSheet.addTable({
        name: 'UsersByPlan',
        ref: 'D1',
        headerRow: true,
        columns: [{ name: 'Gói cước' }, { name: 'Số người dùng' }],
        rows: data.details.usersByPlan.map(p => [p.planName, p.count]),
    });

    return workbook.xlsx.writeBuffer();
  }

  /**
   * Tạo báo cáo dưới dạng file Word.
   */
  public async generateWordReport(range: ReportDateRange): Promise<Buffer> {
    const data = await this.getReportData(range);

    const doc = new Document({
      sections: [{
        children: [
          new Paragraph({ text: 'BÁO CÁO HOẠT ĐỘNG HỆ THỐNG DOGDEX AI', heading: HeadingLevel.TITLE }),
          new Paragraph({ text: `Kỳ báo cáo: ${range.startDate.toLocaleDateString('vi-VN')} - ${range.endDate.toLocaleDateString('vi-VN')}`, style: "IntenseQuote" }),
          new Paragraph({ text: 'I. Tóm tắt tổng quan', heading: HeadingLevel.HEADING_1 }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({ children: [new TableCell({ children: [new Paragraph('Người dùng mới')] }), new TableCell({ children: [new Paragraph(String(data.summary.newUsers))] })] }),
              new TableRow({ children: [new TableCell({ children: [new Paragraph('Tổng người dùng')] }), new TableCell({ children: [new Paragraph(String(data.summary.totalUsers))] })] }),
              new TableRow({ children: [new TableCell({ children: [new Paragraph('Tổng lượt dự đoán')] }), new TableCell({ children: [new Paragraph(String(data.summary.totalPredictions))] })] }),
              new TableRow({ children: [new TableCell({ children: [new Paragraph('Tỷ lệ chính xác (Feedback)')] }), new TableCell({ children: [new Paragraph(`${data.summary.accuracy}%`)] })] }),
            ],
          }),
          new Paragraph({ text: 'II. Chi tiết', heading: HeadingLevel.HEADING_1 }),
          new Paragraph({ text: 'Top giống chó được dự đoán nhiều nhất', heading: HeadingLevel.HEADING_2 }),
          ...data.details.topBreeds.map(b => new Paragraph({ text: `- ${b.breed}: ${b.count} lần`, bullet: { level: 0 } })),
        ],
      }],
    });

    return Packer.toBuffer(doc);
  }
}