<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;
use Exception;
use Intervention\Image\Facades\Image;

/**
 * Service for handling digital signature validation, quality assessment, and processing.
 */
class SignatureService
{
    private const MIN_SIGNATURE_LENGTH = 100;
    private const MIN_CANVAS_WIDTH = 200;
    private const MAX_CANVAS_WIDTH = 800;
    private const MIN_CANVAS_HEIGHT = 100;
    private const MAX_CANVAS_HEIGHT = 400;
    private const MIN_QUALITY_SCORE = 0.85;

    /**
     * Validate signature data
     */
    public function validateSignatureData(string $signatureData): array
    {
        $valid = true;
        $errors = [];

        try {
            // Check data length
            if (strlen($signatureData) < self::MIN_SIGNATURE_LENGTH) {
                $errors[] = 'Signature data is too short';
                $valid = false;
            }

            // Check base64 format
            if (!$this->isValidBase64Image($signatureData)) {
                $errors[] = 'Invalid signature data format';
                $valid = false;
            }

            // Check for obviously fake signatures (straight lines, dots, etc.)
            if ($this->isFakeSignature($signatureData)) {
                $errors[] = 'Signature appears to be fake or invalid';
                $valid = false;
            }

            // Calculate basic entropy to check for randomness
            $entropy = $this->calculateEntropy($signatureData);
            if ($entropy < 3.0) {
                $errors[] = 'Signature lacks sufficient complexity';
                $valid = false;
            }

            return [
                'valid' => $valid,
                'errors' => $errors,
                'data_length' => strlen($signatureData),
                'entropy_score' => $entropy
            ];

        } catch (Exception $e) {
            Log::error('Error validating signature data', ['error' => $e->getMessage()]);
            return [
                'valid' => false,
                'errors' => ['Internal validation error: ' . $e->getMessage()]
            ];
        }
    }

    /**
     * Calculate signature quality score
     */
    public function calculateSignatureQuality(string $signatureData, array $signatureStrokes = []): float
    {
        try {
            $qualityFactors = [];

            // Factor 1: Data length (0-25 points)
            $lengthScore = $this->calculateLengthScore($signatureData);
            $qualityFactors['length'] = $lengthScore;

            // Factor 2: Stroke density and variety (0-25 points)
            $strokeScore = $this->calculateStrokeScore($signatureStrokes, $signatureData);
            $qualityFactors['strokes'] = $strokeScore;

            // Factor 3: Path complexity and entropy (0-25 points)
            $complexityScore = $this->calculateComplexityScore($signatureData);
            $qualityFactors['complexity'] = $complexityScore;

            // Factor 4: Canvas utilization (0-25 points)
            $utilizationScore = $this->calculateUtilizationScore($signatureStrokes);
            $qualityFactors['utilization'] = $utilizationScore;

            // Factor 5: Anti-forgery checks (-10 to +10 points)
            $forgeryScore = $this->calculateAntiForgeryScore($signatureData, $signatureStrokes);
            $qualityFactors['anti_forgery'] = $forgeryScore;

            // Calculate total quality score
            $totalQuality = array_sum($qualityFactors) / 100; // Normalize to 0-1

            // Ensure score is within valid bounds
            $totalQuality = max(0, min(1, $totalQuality));

            Log::info('Signature quality calculated', [
                'factors' => $qualityFactors,
                'total_quality' => $totalQuality
            ]);

            return round($totalQuality, 3);

        } catch (Exception $e) {
            Log::error('Error calculating signature quality', ['error' => $e->getMessage()]);
            return 0.0;
        }
    }

    /**
     * Check if data is valid base64 image
     */
    private function isValidBase64Image(string $data): bool
    {
        try {
            // Remove data:image prefix if present
            $data = preg_replace('#^data:image/\w+;base64,#i', '', $data);
            
            // Decode base64
            $decoded = base64_decode($data, true);
            if ($decoded === false) {
                return false;
            }

            // Check if it's a valid image
            $imageInfo = getimagesizefromstring($decoded);
            return $imageInfo !== false;

        } catch (Exception $e) {
            return false;
        }
    }

    /**
     * Check for fake signatures
     */
    private function isFakeSignature(string $signatureData): bool
    {
        try {
            // Decode signature image
            $data = preg_replace('#^data:image/\w+;base64,#i', '', $signatureData);
            $decoded = base64_decode($data);

            if ($decoded === false) {
                return true;
            }

            // Create image from string
            $image = imagecreatefromstring($decoded);
            if ($image === false) {
                return true;
            }

            $width = imagesx($image);
            $height = imagesy($image);

            // Check for extremely simple patterns (straight lines, single dots, etc.)
            $whitePixels = 0;
            $blackPixels = 0;
            $edgeCount = 0;

            // Sample the image to check for simple patterns
            for ($x = 0; $x < $width; $x += 10) {
                for ($y = 0; $y < $height; $y += 10) {
                    $rgb = imagecolorat($image, $x, $y);
                    $colors = imagecolorsforindex($image, $rgb);

                    // Simple black/white detection
                    $brightness = ($colors['red'] + $colors['green'] + $colors['blue']) / 3;
                    
                    if ($brightness < 128) {
                        $blackPixels++;
                    } else {
                        $whitePixels++;
                    }
                }
            }

            // Check ratios
            $totalSamplingPixels = ($width / 10) * ($height / 10);
            $blackRatio = $blackPixels / $totalSamplingPixels;
            
            // Too few black pixels suggests fake signature
            if ($blackRatio < 0.01) {
                imagedestroy($image);
                return true;
            }

            // Check for straight line patterns
            if ($this->detectStraightLines($image, $width, $height)) {
                imagedestroy($image);
                return true;
            }

            imagedestroy($image);
            return false;

        } catch (Exception $e) {
            Log::error('Error detecting fake signature', ['error' => $e->getMessage()]);
            return true; // Assume fake on error
        }
    }

    /**
     * Calculate entropy of signature data
     */
    private function calculateEntropy(string $data): float
    {
        try {
            $frequency = [];
            $length = strlen($data);

            if ($length === 0) {
                return 0.0;
            }

            // Count character frequencies
            for ($i = 0; $i < $length; $i++) {
                $char = $data[$i];
                if (!isset($frequency[$char])) {
                    $frequency[$char] = 0;
                }
                $frequency[$char]++;
            }

            // Calculate entropy
            $entropy = 0.0;
            foreach ($frequency as $count) {
                $probability = $count / $length;
                $entropy -= $probability * log($probability, 2);
            }

            return $entropy;

        } catch (Exception $e) {
            Log::error('Error calculating entropy', ['error' => $e->getMessage()]);
            return 0.0;
        }
    }

    /**
     * Calculate length-based quality score
     */
    private function calculateLengthScore(string $signatureData): float
    {
        $length = strlen($signatureData);

        if ($length < self::MIN_SIGNATURE_LENGTH) {
            return 0;
        } elseif ($length > 20000) {
            return 25; // Full score for long signatures
        } else {
            // Linear scale between 100 and 20000 characters
            return 25 * min(1, ($length - self::MIN_SIGNATURE_LENGTH) / (20000 - self::MIN_SIGNATURE_LENGTH));
        }
    }

    /**
     * Calculate stroke-based quality score
     */
    private function calculateStrokeScore(array $signatureStrokes, string $signatureData): float
    {
        if (empty($signatureStrokes)) {
            return 0;
        }

        try {
            $strokeCount = count($signatureStrokes);
            $totalStrokeLength = 0;
            $uniqueDirections = [];

            // Calculate total stroke length and unique directions
            foreach ($signatureStrokes as $stroke) {
                if (is_array($stroke) && count($stroke) >= 2) {
                    // Calculate stroke length
                    $start = $stroke[0];
                    $end = end($stroke);
                    $length = sqrt(
                        pow($end[0] - $start[0], 2) + 
                        pow($end[1] - $start[1], 2)
                    );
                    $totalStrokeLength += $length;

                    // Determine stroke direction
                    $direction = atan2($end[1] - $start[1], $end[0] - $start[0]);
                    $directionBucket = round($direction / (pi() / 8)); // 16 buckets
                    $uniqueDirections[$directionBucket] = true;
                }
            }

            // Score based on stroke count and variety
            $baseScore = min(15, $strokeCount * 2); // Max 15 points for stroke count
            $varietyScore = min(10, count($uniqueDirections) * 1.5); // Max 10 points for directional variety

            return $baseScore + $varietyScore;

        } catch (Exception $e) {
            Log::error('Error calculating stroke score', ['error' => $e->getMessage()]);
            return 0;
        }
    }

    /**
     * Calculate complexity score
     */
    private function calculateComplexityScore(string $signatureData): float
    {
        try {
            $entropy = $this->calculateEntropy($signatureData);
            
            // Convert entropy to quality score (0-25 points)
            // Higher entropy = more complex signature
            $complexityScore = min(25, $entropy * 3);

            return $complexityScore;

        } catch (Exception $e) {
            Log::error('Error calculating complexity score', ['error' => $e->getMessage()]);
            return 0;
        }
    }

    /**
     * Calculate canvas utilization score
     */
    private function calculateUtilizationScore(array $signatureStrokes): float
    {
        if (empty($signatureStrokes)) {
            return 0;
        }

        try {
            $allPoints = [];
            
            // Collect all points
            foreach ($signatureStrokes as $stroke) {
                if (is_array($stroke)) {
                    $allPoints = array_merge($allPoints, $stroke);
                }
            }

            if (empty($allPoints)) {
                return 0;
            }

            // Calculate bounding box
            $minX = $maxX = $allPoints[0][0] ?? 0;
            $minY = $maxY = $allPoints[0][1] ?? 0;

            foreach ($allPoints as $point) {
                if (is_array($point) && count($point) >= 2) {
                    $minX = min($minX, $point[0]);
                    $maxX = max($maxX, $point[0]);
                    $minY = min($minY, $point[1]);
                    $maxY = max($maxY, $point[1]);
                }
            }

            $boundingBoxArea = ($maxX - $minX) * ($maxY - $minY);
            $canvasArea = 400 * 200; // Default canvas size

            if ($boundingBoxArea <= 0) {
                return 0;
            }

            // Score based on canvas utilization (0-25 points)
            $utilizationRatio = min(1, $boundingBoxArea / $canvasArea);
            return 25 * $utilizationRatio;

        } catch (Exception $e) {
            Log::error('Error calculating utilization score', ['error' => $e->getMessage()]);
            return 0;
        }
    }

    /**
     * Calculate anti-forgery score
     */
    private function calculateAntiForgeryScore(string $signatureData, array $signatureStrokes): float
    {
        $score = 0;

        try {
            // Check for straight-line patterns (negative score)
            if ($this->hasStraightLinePatterns($signatureStrokes)) {
                $score -= 10;
            }

            // Check for repetitive patterns (negative score)
            if ($this->hasRepetitivePatterns($signatureStrokes)) {
                $score -= 5;
            }

            // Check for reasonable stroke count (positive score)
            if (count($signatureStrokes) >= 3 && count($signatureStrokes) <= 20) {
                $score += 5;
            }

            // Check for natural time progression in strokes (positive score)
            if ($this->hasNaturalTimeProgression($signatureStrokes)) {
                $score += 10;
            }

            return $score;

        } catch (Exception $e) {
            Log::error('Error calculating anti-forgery score', ['error' => $e->getMessage()]);
            return -5; // Default negative score on error
        }
    }

    /**
     * Detect straight lines in signature image
     */
    private function detectStraightLines($image, int $width, int $height): bool
    {
        try {
            // Simple straight line detection by sampling vertical and horizontal lines
            $straightLines = 0;
            
            // Check horizontal lines
            $prevColor = null;
            $sameColorCount = 0;
            
            for ($y = 0; $y < $height; $y += 10) {
                $prevColor = null;
                $sameColorCount = 0;
                
                for ($x = 0; $x < $width; $x += 5) {
                    $rgb = imagecolorat($image, $x, $y);
                    $colors = imagecolorsforindex($image, $rgb);
                    
                    $isBlack = ($colors['red'] + $colors['green'] + $colors['blue']) < 128;
                    
                    if ($sameColorCount === 0) {
                        $prevColor = $isBlack;
                        $sameColorCount = 1;
                    } elseif ($prevColor === $isBlack) {
                        $sameColorCount++;
                    } else {
                        if ($sameColorCount > 20) { // Long run of same color
                            $straightLines++;
                        }
                        $sameColorCount = 1;
                        $prevColor = $isBlack;
                    }
                }
            }

            return $straightLines > 5; // Too many straight lines detected

        } catch (Exception $e) {
            return true; // Assume straight lines on error
        }
    }

    /**
     * Check for straight line patterns in strokes
     */
    private function hasStraightLinePatterns(array $signatureStrokes): bool
    {
        try {
            $straightLineCount = 0;

            foreach ($signatureStrokes as $stroke) {
                if (is_array($stroke) && count($stroke) >= 3) {
                    if ($this->isStraightLine($stroke)) {
                        $straightLineCount++;
                    }
                }
            }

            return $straightLineCount > count($signatureStrokes) * 0.5; // More than 50% straight lines

        } catch (Exception $e) {
            return true; // Assume straight lines on error
        }
    }

    /**
     * Check if stroke is a straight line
     */
    private function isStraightLine(array $points): bool
    {
        if (count($points) < 3) {
            return false;
        }

        try {
            $start = $points[0];
            $end = end($points);
            
            if (abs($end[0] - $start[0]) < 1 && abs($end[1] - $start[1]) < 1) {
                return false; // Too short to determine
            }

            // Calculate expected points along the straight line
            $expectedPoints = [];
            $segments = 10;
            
            for ($i = 0; $i <= $segments; $i++) {
                $ratio = $i / $segments;
                $expectedPoints[] = [
                    $start[0] + ($end[0] - $start[0]) * $ratio,
                    $start[1] + ($end[1] - $start[1]) * $ratio
                ];
            }

            // Check how closely actual points match straight line
            $deviation = 0;
            foreach ($expectedPoints as $i => $expected) {
                if (isset($points[$i % count($points)])) {
                    $actual = $points[$i % count($points)];
                    $deviation += sqrt(
                        pow($expected[0] - $actual[0], 2) +
                        pow($expected[1] - $actual[1], 2)
                    );
                }
            }

            $avgDeviation = $deviation / count($expectedPoints);
            return $avgDeviation < 5; // Small deviation indicates straight line

        } catch (Exception $e) {
            return false;
        }
    }

    /**
     * Check for repetitive patterns
     */
    private function hasRepetitivePatterns(array $signatureStrokes): bool
    {
        try {
            if (count($signatureStrokes) < 3) {
                return false;
            }

            // Simple check: count duplicate strokes
            $strokeSignatures = [];
            
            foreach ($signatureStrokes as $stroke) {
                if (is_array($stroke) && count($stroke) >= 2) {
                    $signature = $this->getStrokeSignature($stroke);
                    
                    if (isset($strokeSignatures[$signature])) {
                        $strokeSignatures[$signature]++;
                    } else {
                        $strokeSignatures[$signature] = 1;
                    }
                }
            }

            // Check for high repetition ratio
            $mostCommonCount = max($strokeSignatures);
            return $mostCommonCount > count($signatureStrokes) * 0.3; // >30% of strokes are duplicates

        } catch (Exception $e) {
            return true; // Assume repetitive on error
        }
    }

    /**
     * Get stroke signature for pattern matching
     */
    private function getStrokeSignature(array $stroke): string
    {
        if (count($stroke) < 2) {
            return '';
        }

        $start = $stroke[0];
        $end = end($stroke);
        
        $direction = atan2($end[1] - $start[1], $end[0] - $start[0]);
        $length = sqrt(pow($end[0] - $start[0], 2) + pow($end[1] - $start[1], 2));
        
        return sprintf('dir:%d_len:%d', round($direction), round($length));
    }

    /**
     * Check for natural time progression
     */
    private function hasNaturalTimeProgression(array $signatureStrokes): bool
    {
        try {
            if (count($signatureStrokes) < 2) {
                return false;
            }

            // Simulate natural timing checks
            // In a real implementation, this would use actual timestamps
            
            $strokeWeights = [];
            foreach ($signatureStrokes as $i => $stroke) {
                if (is_array($stroke) && count($stroke) > 0) {
                    // Estimate stroke time based on complexity
                    $complexity = count($stroke);
                    $estimatedTime = $complexity * 0.1; // 0.1 seconds per point
                    $strokeWeights[] = $estimatedTime;
                }
            }

            // Check if timing seems reasonable
            $totalEstimatedTime = array_sum($strokeWeights);
            return $totalEstimatedTime > 0.5; // At least 0.5 seconds total

        } catch (Exception $e) {
            return false;
        }
    }

    /**
     * Get signature quality recommendations
     */
    public function getQualityRecommendations(float $qualityScore, array $metrics = []): array
    {
        $recommendations = [];

        if ($qualityScore < self::MIN_QUALITY_SCORE) {
            $recommendations[] = [
                'type' => 'error',
                'message' => 'Signature quality is below the recommended threshold (' . self::MIN_QUALITY_SCORE . ')'
            ];
        }

        if (isset($metrics['stroke_count']) && $metrics['stroke_count'] < 3) {
            $recommendations[] = [
                'type' => 'warning',
                'message' => 'Signature appears too simple. Consider using signature capture with more strokes.'
            ];
        }

        if (isset($metrics['data_length']) && $metrics['data_length'] < self::MIN_SIGNATURE_LENGTH * 2) {
            $recommendations[] = [
                'type' => 'info',
                'message' => 'Consider using a larger canvas or signing with more detail.'
            ];
        }

        if (empty($recommendations)) {
            $recommendations[] = [
                'type' => 'success',
                'message' => 'Signature quality is good and meets legal requirements.'
            ];
        }

        return $recommendations;
    }
}