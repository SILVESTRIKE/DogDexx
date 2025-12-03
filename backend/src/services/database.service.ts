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

    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  async createBackup(): Promise<string> {
    try {
      const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
      const backupName = `backup-${timestamp}`;
      const backupPath = path.join(this.backupDir, backupName);

      logger.info(`Starting database backup: ${backupName}`);

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

  async restoreFromBackup(filePath: string): Promise<void> {
    try {
      if (!fs.existsSync(filePath)) {
        throw new AppError('Backup file not found');
      }

      if (!filePath.endsWith('.archive')) {
        throw new AppError('Invalid backup file format. Expected .archive file');
      }

      logger.info(`Starting database restore from: ${filePath}`);

      const command = `mongorestore --uri="${this.mongoUri}" --db=${this.dbName} --archive="${filePath}" --gzip --drop`;

      const { stdout, stderr } = await execAsync(command);

      if (stderr && !stderr.includes('done')) {
        logger.warn(`Restore stderr: ${stderr}`);
      }

      logger.info('Database restore completed successfully');

      if (filePath.includes('temp-restore')) {
        fs.unlinkSync(filePath);
      }
    } catch (error: any) {
      logger.error('Database restore failed:', error);
      throw new AppError('Failed to restore database: ' + error.message);
    }
  }

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
    }
  }
}
