import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger.util';
import { AppError } from '../errors';

const execAsync = promisify(exec);

export class DatabaseService {
  private backupDir: string;
  private mongoUri: string;
  private dbName: string;

  constructor() {
    this.backupDir = path.join(__dirname, '../../backups');
    this.mongoUri = process.env.MONGO_URI || '';
    this.dbName = process.env.DB_NAME || 'dog_breed_id';

    // Đảm bảo thư mục backup tồn tại
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  /**
   * Tạo backup của database
   * @returns Đường dẫn đến file backup
   */
  async createBackup(): Promise<string> {
    try {
      const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
      const backupName = `backup-${timestamp}`;
      const backupPath = path.join(this.backupDir, backupName);

      logger.info(`Starting database backup: ${backupName}`);

      // Sử dụng mongodump để tạo backup
      const command = `mongodump --uri="${this.mongoUri}" --db=${this.dbName} --archive="${backupPath}.archive" --gzip`;

      const { stdout, stderr } = await execAsync(command);

      if (stderr && !stderr.includes('done dumping')) {
        logger.warn(`Backup stderr: ${stderr}`);
      }

      logger.info(`Database backup completed: ${backupPath}.archive`);

      return `${backupPath}.archive`;
    } catch (error: any) {
      logger.error('Database backup failed:', error);
      throw new AppError('Failed to create database backup: ' + error.message);
    }
  }

  /**
   * Khôi phục database từ file backup
   * @param filePath Đường dẫn đến file backup
   */
  async restoreFromBackup(filePath: string): Promise<void> {
    try {
      // Kiểm tra file tồn tại
      if (!fs.existsSync(filePath)) {
        throw new AppError('Backup file not found');
      }

      // Kiểm tra định dạng file
      if (!filePath.endsWith('.archive')) {
        throw new AppError('Invalid backup file format. Expected .archive file');
      }

      logger.info(`Starting database restore from: ${filePath}`);

      // Sử dụng mongorestore để khôi phục
      const command = `mongorestore --uri="${this.mongoUri}" --db=${this.dbName} --archive="${filePath}" --gzip --drop`;

      const { stdout, stderr } = await execAsync(command);

      if (stderr && !stderr.includes('done')) {
        logger.warn(`Restore stderr: ${stderr}`);
      }

      logger.info('Database restore completed successfully');

      // Xóa file tạm sau khi restore
      if (filePath.includes('temp-restore')) {
        fs.unlinkSync(filePath);
      }
    } catch (error: any) {
      logger.error('Database restore failed:', error);
      throw new AppError('Failed to restore database: ' + error.message);
    }
  }

  /**
   * Lấy danh sách các backup có sẵn
   */
  async listBackups(): Promise<Array<{ name: string; path: string; size: number; createdAt: Date }>> {
    try {
      const files = fs.readdirSync(this.backupDir);
      const backups = files
        .filter((file) => file.endsWith('.archive'))
        .map((file) => {
          const filePath = path.join(this.backupDir, file);
          const stats = fs.statSync(filePath);
          return {
            name: file,
            path: filePath,
            size: stats.size,
            createdAt: stats.mtime,
          };
        })
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      return backups;
    } catch (error: any) {
      logger.error('Failed to list backups:', error);
      throw new AppError('Failed to list backups: ' + error.message);
    }
  }

  /**
   * Xóa các backup cũ (giữ lại N backup gần nhất)
   * @param keepCount Số lượng backup cần giữ lại
   */
  async cleanOldBackups(keepCount: number = 10): Promise<void> {
    try {
      const backups = await this.listBackups();

      if (backups.length > keepCount) {
        const toDelete = backups.slice(keepCount);
        for (const backup of toDelete) {
          fs.unlinkSync(backup.path);
          logger.info(`Deleted old backup: ${backup.name}`);
        }
      }
    } catch (error: any) {
      logger.error('Failed to clean old backups:', error);
      // Không throw error, vì đây chỉ là cleanup
    }
  }
}
