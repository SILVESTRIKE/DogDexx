import { Request, Response, NextFunction} from "express";
import { MediaService, FindMediasOptions } from "../services/media.service";
import { BadRequestError, ConflictError } from "../errors";
import { DirectoryService } from "../services/directory.service";
import { transformMediaURLs } from "../utils/media.util";


export class MediaController {
  // Xử lý upload 1 file
  static async uploadSingle(req: Request, res: Response) {
    if (!req.file) {
      throw new BadRequestError("Không có file nào được upload.");
    }

    const { name, description, directory_id } = req.body;

    if (!name) {
      throw new BadRequestError("Trường 'name' là bắt buộc.");
    }

    const mediaData = {
      name: name,
      mediaPath: req.file.path,
      type: req.file.mimetype,
      description: description || null,
      creator_id: (req as any).user?._id,
      directory_id: directory_id,
    };

    const newMedia = await MediaService.createMedia(mediaData as any);
    res.status(201).json(transformMediaURLs(req, newMedia));
  }

  // Xử lý upload nhiều file
  static async uploadMultiple(req: Request, res: Response) {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      throw new BadRequestError("No files were uploaded.");
    }

    const { names, descriptions, directory_id } = req.body;

    if (!names) throw new BadRequestError("names is required.");
    if (!descriptions) throw new BadRequestError("descriptions is required.");

    const namesArray = Array.isArray(names) ? names : [names];
    const descriptionsArray = Array.isArray(descriptions)
      ? descriptions
      : [descriptions];

    if (files.length !== namesArray.length) {
      throw new BadRequestError(
        `files.length (${files.length}) must match names.length (${namesArray.length}).`
      );
    }
    if (files.length !== descriptionsArray.length) {
      throw new BadRequestError(
        `files.length (${files.length}) must match descriptions.length (${descriptionsArray.length}).`
      );
    }

    const mediaPromises = files.map(async (file, index) => {
      const mediaData = {
        name: namesArray[index],
        mediaPath: file.path,
        type: file.mimetype,
        description: descriptionsArray[index],
        creator_id: (req as any).user?._id,
        directory_id: directory_id,
      };
      return MediaService.createMedia(mediaData as any);
    });

    const newMedias = await Promise.all(mediaPromises);
    res.status(201).json(transformMediaURLs(req, newMedias));
  }

  //xử lý 1 file trả về URL
  static async uploadAndGetUrl(req: Request, res: Response) {
    if (!req.file) throw new BadRequestError("No file uploaded.");

    const { name, description, directory_id } = req.body;

    const newMedia = await MediaService.createMedia({
      name: name || req.file.originalname, // Lấy name từ body hoặc fallback về tên gốc
      mediaPath: req.file.path,
      type: req.file.mimetype,
      description: description || null,
      creator_id: (req as any).user?._id,
      directory_id: directory_id,
    } as any);

    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const mediaURL = `${baseUrl}/${newMedia.mediaPath.replace(/\\/g, "/")}`;

    res.status(201).json({ mediaURL });
  }
  static async getMedias(req: Request, res: Response) {
    // req.query đã được Zod middleware validate và transform
    const options = req.query as unknown as FindMediasOptions;
    const result = await MediaService.findAndPaginate(options);
    const dataWithUrl = transformMediaURLs(req, result.data);
    res.status(200).json({ data: dataWithUrl, pagination: result.pagination });
  }

  static async getMediaById(req: Request, res: Response) {
    // req.params.id is validated as an ObjectId string by Zod
    const media_id = (req.params as any).id as string;

    const media = await MediaService.findById(media_id);
    if (!media) {
      throw new ConflictError(`Can't find media with ID: ${media_id}`);
    }

    res.status(200).json(transformMediaURLs(req, media));
  }

  static async updateMediaInfo(req: Request, res: Response) {
    const id = (req.params as any).id as string;

    const updatedMedia = await MediaService.updateInfoMedia(id, req.body);
    if (!updatedMedia) {
      throw new ConflictError(`Can't find media with ID: ${id}`);
    }

    res.status(200).json(transformMediaURLs(req, updatedMedia));
  }

  static async deleteMedia(req: Request, res: Response) {
    const media_id = (req.params as any).id as string;

    const isDeleted = await MediaService.softDeleteMedia(media_id);
    if (!isDeleted) {
      throw new ConflictError(`Can't find media with ID: ${media_id}.`);
    }

    res.status(204).send();
  }
  static async getFileTypeFolders(req: Request, res: Response) {
    const fileTypes = await MediaService.getFileTypeFolders();
    res.status(200).json(fileTypes);
  }
  static async getYearFolders(req: Request, res: Response) {
    const { fileType } = req.params;
    const years = await MediaService.getYearFolders(fileType);
    res.status(200).json(years);
  }

  static async getMonthFolders(req: Request, res: Response) {
    const { fileType } = req.params;
    const { year } = req.params;
    const months = await MediaService.getMonthFolders(fileType, year);
    res.status(200).json(months);
  }

  static async getMediaByPhysicalPath(req: Request, res: Response) {
    const { fileType, year, month } = req.params;
    const options = {
      page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
      search: req.query.search as string,
    };
    const result = await MediaService.findAndPaginateByPhysicalPath(
      fileType,
      year,
      month,
      options
    );
    const transformedData = transformMediaURLs(req, result.data);
    res
      .status(200)
      .json({ data: transformedData, pagination: result.pagination });
  }
  
  
}
export class DirectoryController {
  static async create(req: Request, res: Response) {
    const newDirectory = await DirectoryService.create(
      req.body,
      (req as any).user?._id?.toString()
    );
    res.status(201).json(newDirectory);
  }

  static async getContent(req: Request, res: Response) {
    const directory_id = req.params.id ? req.params.id : null;

    if (directory_id) {
      const dirExists = await DirectoryService.findById(directory_id);
      if (!dirExists)
        throw new ConflictError(`Directory with ID ${directory_id} not exist.`);
    }

    const [subDirectories, mediaResult] = await Promise.all([
      DirectoryService.getChildren(directory_id),
      MediaService.findAndPaginate({
        directory_id: directory_id,
        limit: 1000,
      }),
    ]);

    res.status(200).json({
      directories: subDirectories,
      medias: transformMediaURLs(req, mediaResult.data),
    });
  }
  static async softDelete(req: Request, res: Response) {
    const directoryId = (req.params as any).id as string;

    const directory = await DirectoryService.findById(directoryId);
    if (!directory) {
      throw new ConflictError(`Directory with ID ${directoryId} not exist.`);
    }

    await DirectoryService.softDeleteRecursive(directoryId);

    res.status(204).send();
  }
  static async getBreadcrumb(req: Request, res: Response) {
    const directoryId = req.params.id as string;
    const breadcrumb = await DirectoryService.getBreadcrumb(directoryId);
    res.status(200).json(breadcrumb);
  }
  static async rename(req: Request, res: Response) {
    const directoryId = req.params.id as string;
    const { name } = req.body;

    const updatedDirectory = await DirectoryService.rename(
      directoryId,
      name
    );
    if (!updatedDirectory) {
      throw new ConflictError(`Directory with ID ${directoryId} not exist.`);
    }

    res.status(200).json(updatedDirectory);
  }
  static async move(req: Request, res: Response) {
    const directoryId = req.params.id as string;
    const { parent_id } = req.body;

    if (parent_id) {
      const parentDir = await DirectoryService.findById(parent_id);
      if (!parentDir) {
        throw new ConflictError(`Parent directory with ID ${parent_id} not exist.`);
      }
    }

    const movedDirectory = await DirectoryService.move(
      directoryId,
      parent_id
    );
    if (!movedDirectory) {
      throw new ConflictError(`Directory with ID ${directoryId} not exist.`);
    }

    res.status(200).json(movedDirectory);
  }
  static async getAll(req: Request, res: Response) {
    const directories = await DirectoryService.getAll();
    res.status(200).json(directories);
  }
}
