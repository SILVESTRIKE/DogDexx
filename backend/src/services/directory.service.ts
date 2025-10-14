import { DirectoryModel, DirectoryDoc } from "../models/directory.model";
import { CreateDirectoryZodType } from "../types/zod/medias.zod";
import { MediaModel } from "../models/medias.model";
import mongoose from "mongoose";

export class DirectoryService {
  static async create(
    data: CreateDirectoryZodType,
    creator_id: mongoose.Types.ObjectId
  ): Promise<DirectoryDoc> {
    const newDirectory = new DirectoryModel({ ...data, creator_id });
    return newDirectory.save();
  }

  static async findById(id: string): Promise<DirectoryDoc | null> {
    return DirectoryModel.findOne({ _id: id, isDeleted: false });
  }

  static async getChildren(parent_id: string | null): Promise<DirectoryDoc[]> {
    return DirectoryModel.find({ parent_id, isDeleted: false }).sort({
      name: "asc",
    });
  }

  static async softDeleteRecursive(directoryId: string): Promise<void> {
    // Cập nhật tất cả media trong thư mục này sang trạng thái đã xóa
    await MediaModel.updateMany(
      { directory_name: directoryId, isDeleted: false },
      { $set: { isDeleted: true } }
    );

    // Tìm các thư mục con
    const subDirectories = await DirectoryModel.find({
      parent_id: directoryId,
      isDeleted: false,
    });

    // Đệ quy xóa các thư mục con
    if (subDirectories.length > 0) {
      await Promise.all(
        subDirectories.map((subDir) =>
          this.softDeleteRecursive(subDir._id.toString())
        )
      );
    }

    // Xóa thư mục hiện tại
    await DirectoryModel.findByIdAndUpdate(directoryId, {
      $set: { isDeleted: true },
    });
  }

  static async getBreadcrumb(directoryId: string): Promise<DirectoryDoc[]> {
    const breadcrumb: DirectoryDoc[] = [];
    let currentId: string | null = directoryId;

    while (currentId) {
      const directory: DirectoryDoc | null = await DirectoryModel.findOne({
        _id: currentId,
        isDeleted: false,
      }).select("_id name parent_id");

      if (directory) {
        breadcrumb.unshift(directory);
        currentId = directory.parent_id ? directory.parent_id.toString() : null;
      } else {
        break;
      }
    }
    return breadcrumb;
  }
  static async rename(
    directoryId: string,
    name: string
  ): Promise<DirectoryDoc | null> {
    return DirectoryModel.findOneAndUpdate(
      { _id: directoryId, isDeleted: false },
      { name },
      { new: true }
    );
  }
  static async move(
    directoryId: string,
    parent_id: string | null
  ): Promise<DirectoryDoc | null> {
    return DirectoryModel.findOneAndUpdate(
      { _id: directoryId, isDeleted: false },
      { parent_id },
      { new: true }
    );
  }
  static async getAll(): Promise<DirectoryDoc[]> {
    return DirectoryModel.find({ isDeleted: false }).sort({ name: "asc" });
  }
}
