import express from "express";
import { authMiddleware } from "../middlewares/auth.middleware";
import { validateData } from "../middlewares/validation.middleware"; // Assuming this exists or you implement it
import { createDogSchema, updateDogSchema, createHealthRecordSchema } from "../validation";
import {
    createDog,
    getMyDogs,
    getDog,
    updateDog,
    deleteDog,
    addHealthRecord,
    getHealthRecords,
    searchLostDogs,
} from "../controllers/dog.controller";

const router = express.Router();

// Dog Profile Routes
router.post("/", authMiddleware, validateData(createDogSchema), createDog);
router.get("/my-dogs", authMiddleware, getMyDogs);
router.get("/search/lost", searchLostDogs);
router.get("/:id", authMiddleware, getDog);
router.put("/:id", authMiddleware, validateData(updateDogSchema), updateDog);
router.delete("/:id", authMiddleware, deleteDog);

// Health Record Routes
router.post("/:dogId/health", authMiddleware, validateData(createHealthRecordSchema), addHealthRecord);
router.get("/:dogId/health", authMiddleware, getHealthRecords);

export default router;
