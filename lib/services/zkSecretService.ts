/**
 * ZK Secret Service - Zero-Knowledge Secret Management
 * Handles secret question hashing, validation, and recovery backup
 */

import { ethers } from "ethers";
import { randomBytes } from "crypto";

export interface SecretHash {
  hash: string;
  salt: string;
  timestamp: number;
}

export interface SecretBackup {
  walletAddress: string;
  ensName: string;
  salt: string;
  hashCommitment: string;
  createdAt: string;
  version: string;
  network: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
}

/**
 * ZK Secret Service for wallet recovery
 */
export class ZKSecretService {
  private static readonly VERSION = "1.0.0";
  private static readonly MIN_QUESTION_LENGTH = 10;
  private static readonly MAX_QUESTION_LENGTH = 200;
  private static readonly MIN_ANSWER_LENGTH = 3;
  private static readonly MAX_ANSWER_LENGTH = 100;

  /**
   * Generate secret hash from question, answer, and salt
   * Hash = keccak256(question || answer || salt)
   */
  static generateSecretHash(
    question: string,
    answer: string,
    salt?: string
  ): SecretHash {
    // Generate salt if not provided (32 bytes = 64 hex characters)
    const finalSalt = salt || ethers.hexlify(randomBytes(32));

    // Normalize question: lowercase and trim whitespace
    const normalizedQuestion = question.trim().toLowerCase();

    // Keep answer as-is for case sensitivity
    const normalizedAnswer = answer.trim();

    // Create combined data: question + answer + salt
    const combined = ethers.concat([
      ethers.toUtf8Bytes(normalizedQuestion),
      ethers.toUtf8Bytes(normalizedAnswer),
      ethers.getBytes(finalSalt),
    ]);

    // Hash using keccak256
    const hash = ethers.keccak256(combined);

    return {
      hash,
      salt: finalSalt,
      timestamp: Date.now(),
    };
  }

  /**
   * Verify secret answer against stored hash
   */
  static verifySecret(
    question: string,
    answer: string,
    salt: string,
    expectedHash: string
  ): boolean {
    const { hash } = this.generateSecretHash(question, answer, salt);
    return hash.toLowerCase() === expectedHash.toLowerCase();
  }

  /**
   * Create recovery backup object
   */
  static createBackup(
    walletAddress: string,
    ensName: string,
    salt: string,
    hash: string,
    network: string = "sepolia"
  ): SecretBackup {
    return {
      walletAddress: walletAddress.toLowerCase(),
      ensName,
      salt,
      hashCommitment: hash,
      createdAt: new Date().toISOString(),
      version: this.VERSION,
      network,
    };
  }

  /**
   * Export backup as JSON string
   */
  static exportBackup(backup: SecretBackup): string {
    return JSON.stringify(backup, null, 2);
  }

  /**
   * Parse backup from JSON string
   */
  static parseBackup(json: string): SecretBackup {
    try {
      const backup = JSON.parse(json);

      // Validate required fields
      const requiredFields = ["walletAddress", "ensName", "salt", "hashCommitment"];
      const missingFields = requiredFields.filter((field) => !backup[field]);

      if (missingFields.length > 0) {
        throw new Error(`Missing required fields: ${missingFields.join(", ")}`);
      }

      // Validate addresses are properly formatted
      if (!ethers.isAddress(backup.walletAddress)) {
        throw new Error("Invalid wallet address in backup");
      }

      // Validate hash format
      if (!backup.hashCommitment.startsWith("0x") || backup.hashCommitment.length !== 66) {
        throw new Error("Invalid hash commitment format");
      }

      // Validate salt format
      if (!backup.salt.startsWith("0x") || backup.salt.length !== 66) {
        throw new Error("Invalid salt format");
      }

      return backup as SecretBackup;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error("Invalid JSON format");
      }
      throw error;
    }
  }

  /**
   * Validate secret question quality
   */
  static validateQuestion(question: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check length
    if (question.length < this.MIN_QUESTION_LENGTH) {
      errors.push(`Question too short (minimum ${this.MIN_QUESTION_LENGTH} characters)`);
    }

    if (question.length > this.MAX_QUESTION_LENGTH) {
      errors.push(`Question too long (maximum ${this.MAX_QUESTION_LENGTH} characters)`);
    }

    // Check for weak patterns (public/searchable information)
    const weakPatterns = [
      { pattern: /mother'?s?\s+(maiden\s+)?name/i, message: "Avoid using mother's name" },
      { pattern: /father'?s?\s+name/i, message: "Avoid using father's name" },
      { pattern: /\b(born|birth)\b/i, message: "Avoid questions about birthplace/date" },
      { pattern: /\bschool\b/i, message: "Avoid questions about schools" },
      { pattern: /\bcity\b/i, message: "Avoid questions about cities" },
      { pattern: /\bstreet\b/i, message: "Avoid questions about addresses" },
      { pattern: /maiden\s+name/i, message: "Maiden names are often public" },
      { pattern: /\bbirthday\b/i, message: "Birthdays are often public" },
      { pattern: /birth\s+date/i, message: "Birth dates are often public" },
      { pattern: /pet'?s?\s+name/i, message: "Pet names might be on social media" },
      { pattern: /favorite\s+(color|food|movie)/i, message: "Favorite things can be guessed" },
    ];

    for (const { pattern, message } of weakPatterns) {
      if (pattern.test(question)) {
        warnings.push(message);
      }
    }

    // Check for question mark
    if (!question.includes("?")) {
      warnings.push("Question should end with '?'");
    }

    // Check if question is too simple
    const words = question.trim().split(/\s+/).length;
    if (words < 5) {
      warnings.push("Question seems too simple - add more context");
    }

    // Strong recommendation patterns
    const goodPatterns = [
      /invented?|created?|made\s+up/i,
      /whispered?|said\s+to/i,
      /secret|private|personal/i,
      /imaginary|pretend/i,
      /childhood\s+phrase|when\s+I\s+was\s+young/i,
    ];

    const hasGoodPattern = goodPatterns.some((pattern) => pattern.test(question));
    if (!hasGoodPattern && warnings.length === 0) {
      warnings.push(
        "Consider using phrases like 'invented', 'secret phrase', or 'imaginary friend'"
      );
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Validate secret answer quality
   */
  static validateAnswer(answer: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check length
    if (answer.length < this.MIN_ANSWER_LENGTH) {
      errors.push(`Answer too short (minimum ${this.MIN_ANSWER_LENGTH} characters)`);
    }

    if (answer.length > this.MAX_ANSWER_LENGTH) {
      errors.push(`Answer too long (maximum ${this.MAX_ANSWER_LENGTH} characters)`);
    }

    // Check for very common/weak answers
    const commonAnswers = [
      "123",
      "password",
      "test",
      "abc",
      "qwerty",
      "admin",
      "user",
      "default",
    ];

    if (commonAnswers.includes(answer.toLowerCase())) {
      errors.push("Answer is too common - choose something unique");
    }

    // Check complexity
    const hasNumbers = /\d/.test(answer);
    const hasLetters = /[a-zA-Z]/.test(answer);
    const hasSpecialChars = /[^a-zA-Z0-9\s]/.test(answer);

    if (!hasLetters) {
      warnings.push("Consider including letters in your answer");
    }

    // Recommend complexity for better security
    if (!hasNumbers && !hasSpecialChars) {
      warnings.push("Consider adding numbers or special characters for stronger security");
    }

    // Check for only spaces
    if (answer.trim().length === 0) {
      errors.push("Answer cannot be only whitespace");
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Generate downloadable backup file
   */
  static generateBackupFile(backup: SecretBackup): Blob {
    const content = this.exportBackup(backup);
    return new Blob([content], { type: "application/json" });
  }

  /**
   * Generate backup filename
   */
  static generateBackupFilename(ensName: string): string {
    const sanitizedName = ensName.replace(/[^a-zA-Z0-9.-]/g, "_");
    const timestamp = new Date().toISOString().split("T")[0];
    return `novavault-recovery-${sanitizedName}-${timestamp}.json`;
  }

  /**
   * Download backup file
   */
  static downloadBackup(backup: SecretBackup): void {
    const blob = this.generateBackupFile(backup);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = this.generateBackupFilename(backup.ensName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Encrypt backup with password (simple XOR - upgrade for production)
   */
  static encryptBackup(backup: SecretBackup, password: string): string {
    const json = this.exportBackup(backup);
    const encoder = new TextEncoder();
    const data = encoder.encode(json);
    const key = encoder.encode(password);

    // Simple XOR encryption (use proper encryption in production!)
    const encrypted = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i++) {
      encrypted[i] = data[i] ^ key[i % key.length];
    }

    return Buffer.from(encrypted).toString("base64");
  }

  /**
   * Decrypt backup with password
   */
  static decryptBackup(encryptedData: string, password: string): SecretBackup {
    const encrypted = Buffer.from(encryptedData, "base64");
    const encoder = new TextEncoder();
    const key = encoder.encode(password);

    // Simple XOR decryption
    const decrypted = new Uint8Array(encrypted.length);
    for (let i = 0; i < encrypted.length; i++) {
      decrypted[i] = encrypted[i] ^ key[i % key.length];
    }

    const decoder = new TextDecoder();
    const json = decoder.decode(decrypted);
    return this.parseBackup(json);
  }

  /**
   * Generate QR code data for backup
   */
  static generateQRData(backup: SecretBackup): string {
    // Only include essential data for QR code
    const qrData = {
      s: backup.salt,
      e: backup.ensName,
      w: backup.walletAddress,
    };
    return JSON.stringify(qrData);
  }

  /**
   * Parse QR code data
   */
  static parseQRData(qrData: string): {
    salt: string;
    ensName: string;
    walletAddress: string;
  } {
    const data = JSON.parse(qrData);
    return {
      salt: data.s,
      ensName: data.e,
      walletAddress: data.w,
    };
  }

  /**
   * Estimate security strength of question/answer pair
   */
  static estimateStrength(question: string, answer: string): {
    score: number; // 0-100
    level: "weak" | "moderate" | "strong" | "very-strong";
    recommendations: string[];
  } {
    let score = 0;
    const recommendations: string[] = [];

    // Question quality
    const questionValidation = this.validateQuestion(question);
    if (questionValidation.valid) {
      score += 25;
    }
    if (!questionValidation.warnings || questionValidation.warnings.length === 0) {
      score += 25;
    }

    // Answer complexity
    const answerValidation = this.validateAnswer(answer);
    if (answerValidation.valid) {
      score += 25;
    }

    // Additional checks
    if (answer.length >= 8) score += 10;
    if (/[A-Z]/.test(answer)) score += 5;
    if (/[a-z]/.test(answer)) score += 5;
    if (/\d/.test(answer)) score += 5;
    if (/[^a-zA-Z0-9]/.test(answer)) score += 5;

    // Determine level
    let level: "weak" | "moderate" | "strong" | "very-strong";
    if (score >= 80) {
      level = "very-strong";
    } else if (score >= 60) {
      level = "strong";
    } else if (score >= 40) {
      level = "moderate";
    } else {
      level = "weak";
    }

    // Generate recommendations
    if (score < 60) {
      recommendations.push("Choose a more unique secret question");
      recommendations.push("Make your answer longer and more complex");
    }
    if (!questionValidation.warnings || questionValidation.warnings.length > 0) {
      recommendations.push("Avoid questions with public/searchable answers");
    }
    if (answer.length < 8) {
      recommendations.push("Use at least 8 characters in your answer");
    }
    if (!/\d/.test(answer)) {
      recommendations.push("Add numbers to your answer");
    }
    if (!/[^a-zA-Z0-9]/.test(answer)) {
      recommendations.push("Add special characters to your answer");
    }

    return { score, level, recommendations };
  }
}

// Export utility functions
export const zkSecretUtils = {
  /**
   * Quick hash generation without full validation
   */
  quickHash: (question: string, answer: string, salt?: string) => {
    return ZKSecretService.generateSecretHash(question, answer, salt);
  },

  /**
   * Quick verification
   */
  quickVerify: (question: string, answer: string, salt: string, hash: string) => {
    return ZKSecretService.verifySecret(question, answer, salt, hash);
  },

  /**
   * Validate both question and answer
   */
  validateAll: (question: string, answer: string) => {
    const questionResult = ZKSecretService.validateQuestion(question);
    const answerResult = ZKSecretService.validateAnswer(answer);

    return {
      valid: questionResult.valid && answerResult.valid,
      question: questionResult,
      answer: answerResult,
    };
  },
};
