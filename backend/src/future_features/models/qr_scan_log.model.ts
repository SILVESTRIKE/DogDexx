import mongoose, { Schema, Document } from 'mongoose';

/**
 * QR Scan Log Model
 * Tracks when someone scans a dog's QR code
 * Useful for finding lost dogs and admin analytics
 */

export interface QrScanLogDoc extends Document {
    dog_id: mongoose.Types.ObjectId;
    dog_name: string;
    owner_id: mongoose.Types.ObjectId;

    // Scanner info
    scannerIp: string;
    location?: {
        city?: string;
        region?: string;
        country?: string;
        lat?: number;
        lon?: number;
    };

    // Context
    dogWasLost: boolean;
    alertSent: boolean;

    createdAt: Date;
}

const qrScanLogSchema = new Schema<QrScanLogDoc>(
    {
        dog_id: { type: Schema.Types.ObjectId, ref: 'DogProfile', required: true, index: true },
        dog_name: { type: String, required: true },
        owner_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

        scannerIp: { type: String, required: true },
        location: {
            city: String,
            region: String,
            country: String,
            lat: Number,
            lon: Number
        },

        dogWasLost: { type: Boolean, default: false },
        alertSent: { type: Boolean, default: false }
    },
    {
        timestamps: true,
        collection: 'qr_scan_logs'
    }
);

// Index for time-based queries
qrScanLogSchema.index({ createdAt: -1 });

export const QrScanLogModel = mongoose.model<QrScanLogDoc>('QrScanLog', qrScanLogSchema);
