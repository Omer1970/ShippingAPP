<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Resource for transforming DeliveryConfirmation data
 */
class DeliveryConfirmationResource extends JsonResource
{
    /**
     * Transform the resource into an array
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'shipment_id' => $this->shipment_id,
            'user_id' => $this->user_id,
            'delivered_at' => $this->delivered_at ? $this->delivered_at->toISOString() : null,
            'delivered_by' => $this->user ? $this->user->name : null,
            'recipient_name' => $this->recipient_name,
            'signature_data' => $this->signature ? $this->signature->signature_data : null,
            'signature_hash' => $this->signature ? $this->signature->signature_hash : null,
            'photo_urls' => $this->getPhotoUrls(),
            'gps_location' => [
                'latitude' => $this->gps_latitude,
                'longitude' => $this->gps_longitude,
                'accuracy' => $this->gps_accuracy,
                'timestamp' => $this->delivered_at ? $this->delivered_at->toISOString() : null,
            ],
            'delivery_notes' => $this->delivery_notes,
            'status' => $this->status,
            'synced_to_erp' => $this->synced_to_erp,
            'erp_sync_timestamp' => $this->erp_sync_timestamp ? $this->erp_sync_timestamp->toISOString() : null,
            'created_at' => $this->created_at ? $this->created_at->toISOString() : null,
            'updated_at' => $this->updated_at ? $this->updated_at->toISOString() : null,
            'metadata' => [
                'delivery_time_seconds' => $this->getDeliveryTimeSeconds(),
                'signature_confidence' => $this->signature ? $this->signature->signature_quality : 0,
                'photo_count' => $this->photos()->count(),
                'gps_accuracy_meters' => $this->gps_accuracy ?? 5.0,
            ],
            // Include relationships if loaded
            'signature' => $this->when($this->signature, function () {
                return new DeliverySignatureResource($this->signature);
            }),
            'photos' => $this->when($this->photos, function () {
                return DeliveryPhotoResource::collection($this->photos);
            }),
            'user' => $this->when($this->user, function () {
                return new UserResource($this->user);
            }),
            'shipment' => $this->when($this->shipment, function () {
                return new ShipmentResource($this->shipment);
            })
        ];
    }

    /**
     * Get photo URLs for the delivery
     */
    private function getPhotoUrls(): array
    {
        $urls = [];
        
        foreach ($this->photos as $photo) {
            $urls[] = [
                'id' => $photo->id,
                'url' => $photo->getPhotoUrl(),
                'thumbnail_url' => $photo->getThumbnailUrl(),
                'type' => $photo->photo_type,
                'metadata' => [
                    'width' => $photo->getImageDimensions()['width'] ?? null,
                    'height' => $photo->getImageDimensions()['height'] ?? null,
                    'file_size' => $photo->getFileSizeFormatted(),
                    'has_gps' => $photo->hasGPSData(),
                    'gps_coordinates' => $photo->getGPSLocation()
                ]
            ];
        }
        
        return $urls;
    }

    /**
     * Calculate delivery time in seconds from creation to delivery
     */
    private function getDeliveryTimeSeconds(): ?int
    {
        if (!$this->delivered_at || !$this->created_at) {
            return null;
        }
        
        return $this->created_at->diffInSeconds($this->delivered_at);
    }
}