import { UserModel } from '../models/user.model';
import { PredictionHistoryModel } from '../models/prediction_history.model';
import { FeedbackModel } from '../models/feedback.model';
import { PlanModel } from '../models/plan.model';
import { TransactionModel } from '../models/transaction.model';
import { cloudinary } from '../config/cloudinary.config'; // THÊM: Import Cloudinary
import * as ExcelJS from 'exceljs';
import { 
  Document, Packer, Paragraph, TextRun, HeadingLevel, 
  Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType 
} from 'docx';

export interface ReportDateRange {
  startDate: Date;
  endDate: Date;
}

// Helper format bytes để hiển thị trong báo cáo (ví dụ: 1024 -> 1 KB)
const formatBytes = (bytes: number, decimals = 2) => {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

export class ReportService {
  /**
   * Lấy dữ liệu báo cáo tổng hợp (Bao gồm cả Cloudinary).
   */
  public async getReportData(range: ReportDateRange) {
    const { startDate, endDate } = range;

    const [
      totalUsers,
      newUsers,
      activeUsers,
      totalPredictions,
      revenueStats,
      feedbackStats,
      dailyActivity,
      topBreeds,
      usersByPlan,
      cloudinaryUsage // THÊM: Lấy dữ liệu Cloudinary
    ] = await Promise.all([
      // 1. Basic Stats
      UserModel.countDocuments({ isDeleted: false, createdAt: { $lte: endDate } }),
      UserModel.countDocuments({ isDeleted: false, createdAt: { $gte: startDate, $lte: endDate } }),
      PredictionHistoryModel.distinct('user', { createdAt: { $gte: startDate, $lte: endDate } }),
      
      // 2. Engagement
      PredictionHistoryModel.countDocuments({ createdAt: { $gte: startDate, $lte: endDate } }),
      
      // 3. Revenue
      TransactionModel.aggregate([
        { $match: { status: 'completed', createdAt: { $gte: startDate, $lte: endDate } } },
        { $group: { _id: null, totalRevenue: { $sum: '$amount' }, avgOrderValue: { $avg: '$amount' } } }
      ]),

      // 4. Feedback
      FeedbackModel.aggregate([
        { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
        { 
            $group: { 
                _id: null, 
                total: { $sum: 1 },
                approved: { $sum: { $cond: [{ $eq: ["$status", "approved_for_training"] }, 1, 0] } }
            } 
        }
      ]),

      // 5. Charts Data
      PredictionHistoryModel.aggregate([
        { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
        { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]),

      // 6. Top Breeds
      PredictionHistoryModel.aggregate([
        { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
        { $unwind: '$predictions' },
        { $group: { _id: '$predictions.class', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
        { $project: { breed: '$_id', count: 1, _id: 0 } },
      ]),

      // 7. Plan Distribution
      UserModel.aggregate([
        { $match: { isDeleted: false } },
        { $group: { _id: '$plan', count: { $sum: 1 } } },
        { $lookup: { from: 'plans', localField: '_id', foreignField: 'slug', as: 'planDetails' } },
        { $project: { planName: { $ifNull: [{ $arrayElemAt: ['$planDetails.name', 0] }, '$_id'] }, count: 1, _id: 0 } }
      ]),

      // 8. Cloudinary Usage (Gọi API real-time)
      cloudinary.api.usage().catch(err => {
          console.error("Failed to fetch Cloudinary usage for report:", err.message);
          return null;
      })
    ]);

    // Xử lý số liệu tính toán
    const totalRevenue = revenueStats[0]?.totalRevenue || 0;
    const activeUserCount = activeUsers.length;
    const arpu = activeUserCount > 0 ? totalRevenue / activeUserCount : 0;
    const totalFeedbacks = feedbackStats[0]?.total || 0;
    const approvedFeedbacks = feedbackStats[0]?.approved || 0;
    const accuracy = totalFeedbacks > 0 ? (approvedFeedbacks / totalFeedbacks) * 100 : 0;

    // Xử lý Cloudinary Data
    const infraStats = cloudinaryUsage ? {
        plan: cloudinaryUsage.plan,
        credits: {
            used: cloudinaryUsage.credits?.usage || 0,
            limit: cloudinaryUsage.credits?.limit || 0,
            percent: cloudinaryUsage.credits?.used_percent || 0
        },
        storage: {
            used: formatBytes(cloudinaryUsage.storage?.usage || 0),
            raw: cloudinaryUsage.storage?.usage || 0
        },
        bandwidth: {
            used: formatBytes(cloudinaryUsage.bandwidth?.usage || 0),
            raw: cloudinaryUsage.bandwidth?.usage || 0
        },
        objects: cloudinaryUsage.objects?.usage || 0
    } : null;

    return {
      meta: { startDate, endDate, generatedAt: new Date() },
      overview: { totalUsers, newUsers, activeUsers: activeUserCount, totalPredictions, totalRevenue, arpu, accuracy: parseFloat(accuracy.toFixed(2)) },
      infra: infraStats, // Thêm vào kết quả trả về
      charts: { dailyActivity, topBreeds, usersByPlan },
    };
  }

  /**
   * Tạo báo cáo Excel.
   */
  public async generateExcelReport(range: ReportDateRange): Promise<ExcelJS.Buffer> {
    const data = await this.getReportData(range);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'DogDex Admin';

    // --- SHEET 1: DASHBOARD ---
    const dashboardSheet = workbook.addWorksheet('Dashboard Summary');
    const headerStyle = { font: { bold: true, size: 12, color: { argb: 'FFFFFFFF' } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F75B5' } } } as any;

    dashboardSheet.columns = [
      { header: 'Hạng mục', key: 'metric', width: 40 },
      { header: 'Giá trị', key: 'value', width: 25 },
      { header: 'Ghi chú', key: 'note', width: 40 },
    ];
    dashboardSheet.getRow(1).eachCell((cell) => { cell.font = headerStyle.font; cell.fill = headerStyle.fill; });

    // Helper để thêm dòng tiêu đề section
    const addSectionHeader = (title: string) => {
        const row = dashboardSheet.addRow({ metric: title });
        row.font = { bold: true };
        row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
    };

    addSectionHeader('I. Tài chính & Tăng trưởng');
    dashboardSheet.addRow({ metric: '  Doanh thu tổng (Revenue)', value: data.overview.totalRevenue.toLocaleString('vi-VN') + ' VND' });
    dashboardSheet.addRow({ metric: '  ARPU (Trung bình/User)', value: data.overview.arpu.toLocaleString('vi-VN') + ' VND' });
    dashboardSheet.addRow({ metric: '  Người dùng mới', value: data.overview.newUsers });
    dashboardSheet.addRow({ metric: '  Tổng người dùng', value: data.overview.totalUsers });

    addSectionHeader('II. Hiệu suất & Tương tác');
    dashboardSheet.addRow({ metric: '  Tổng lượt dự đoán', value: data.overview.totalPredictions });
    dashboardSheet.addRow({ metric: '  Người dùng hoạt động (Active)', value: data.overview.activeUsers });
    dashboardSheet.addRow({ metric: '  Độ chính xác AI (Feedback)', value: `${data.overview.accuracy}%` });

    // --- THÊM PHẦN HẠ TẦNG VÀO EXCEL ---
    if (data.infra) {
        addSectionHeader('III. Hạ tầng & Tài nguyên (Cloudinary)');
        dashboardSheet.addRow({ metric: '  Gói Cloudinary hiện tại', value: data.infra.plan });
        dashboardSheet.addRow({ metric: '  Credits đã dùng', value: `${data.infra.credits.used.toFixed(2)} / ${data.infra.credits.limit}`, note: `${data.infra.credits.percent.toFixed(2)}%` });
        dashboardSheet.addRow({ metric: '  Dung lượng lưu trữ (Storage)', value: data.infra.storage.used });
        dashboardSheet.addRow({ metric: '  Băng thông (Bandwidth)', value: data.infra.bandwidth.used, note: 'Trong 30 ngày qua' });
        dashboardSheet.addRow({ metric: '  Tổng số file (Assets)', value: data.infra.objects, note: 'Ảnh & Video' });
    }

    // --- SHEET 2: DATA FOR CHARTS ---
    const chartDataSheet = workbook.addWorksheet('Data for Charts');
    chartDataSheet.getCell('A1').value = 'Top Breeds';
    chartDataSheet.getRow(2).values = ['Giống chó', 'Số lần'];
    data.charts.topBreeds.forEach(b => chartDataSheet.addRow([b.breed, b.count]));

    return workbook.xlsx.writeBuffer();
  }

  /**
   * Tạo báo cáo Word.
   */
  public async generateWordReport(range: ReportDateRange): Promise<Buffer> {
    const data = await this.getReportData(range);

    const createCell = (text: string, bold = false) => new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text, bold })] })],
        verticalAlign: AlignmentType.CENTER,
    });

    const children = [
        new Paragraph({ text: 'BÁO CÁO HIỆU SUẤT HỆ THỐNG', heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER }),
        new Paragraph({ text: `Kỳ báo cáo: ${range.startDate.toLocaleDateString('vi-VN')} - ${range.endDate.toLocaleDateString('vi-VN')}`, alignment: AlignmentType.CENTER, spacing: { after: 400 } }),

        // 1. Tài chính
        new Paragraph({ text: '1. Tổng quan Tài chính', heading: HeadingLevel.HEADING_1 }),
        new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
                new TableRow({ children: [createCell("Doanh thu", true), createCell("ARPU", true), createCell("New Users", true)] }),
                new TableRow({ children: [createCell(`${data.overview.totalRevenue.toLocaleString('vi-VN')} đ`), createCell(`${data.overview.arpu.toLocaleString('vi-VN')} đ`), createCell(`${data.overview.newUsers}`)] })
            ]
        }),
        new Paragraph({ text: '\n' }),

        // 2. Top Breeds
        new Paragraph({ text: '2. Top giống chó phổ biến', heading: HeadingLevel.HEADING_1 }),
        new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
                new TableRow({ children: [createCell("Hạng", true), createCell("Giống chó", true), createCell("Lượt xem", true)] }),
                ...data.charts.topBreeds.slice(0, 5).map((b, i) => new TableRow({
                    children: [createCell(`#${i + 1}`), createCell(b.breed), createCell(String(b.count))]
                }))
            ]
        }),
        new Paragraph({ text: '\n' }),
    ];

    // --- THÊM PHẦN HẠ TẦNG VÀO WORD ---
    if (data.infra) {
        children.push(
            new Paragraph({ text: '3. Hạ tầng & Tài nguyên (Cloudinary)', heading: HeadingLevel.HEADING_1 }),
            new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: [
                    new TableRow({ children: [createCell("Tài nguyên", true), createCell("Sử dụng", true), createCell("Trạng thái", true)] }),
                    new TableRow({ children: [createCell("Credits Plan"), createCell(`${data.infra.credits.used.toFixed(2)} / ${data.infra.credits.limit}`), createCell(`${data.infra.credits.percent.toFixed(2)}%`)] }),
                    new TableRow({ children: [createCell("Net Storage"), createCell(data.infra.storage.used), createCell("-")] }),
                    new TableRow({ children: [createCell("Bandwidth (30d)"), createCell(data.infra.bandwidth.used), createCell("-")] }),
                    new TableRow({ children: [createCell("Total Assets"), createCell(String(data.infra.objects)), createCell("Files")] }),
                ]
            })
        );
    }

    // Footer
    children.push(new Paragraph({ text: `\nXuất lúc: ${new Date().toLocaleString('vi-VN')}`, alignment: AlignmentType.RIGHT, style: "IntenseQuote" }));

    const doc = new Document({ sections: [{ children }] });
    return Packer.toBuffer(doc);
  }
}