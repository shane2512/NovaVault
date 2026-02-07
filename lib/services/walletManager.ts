/**
 * Wallet Manager Service
 * 
 * Manages user wallet associations, active wallet state, and wallet metadata.
 * Provides interface for multi-wallet management similar to MetaMask.
 */

import { CircleWallet } from './circleService';

// Types
export interface UserWallet {
  id: string;
  userId: string;
  circleWalletId: string;
  address: string;
  blockchain: string;
  arcSmartWalletAddress?: string;
  name?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, any>;
}

export interface WalletCreateData {
  userId: string;
  circleWalletId: string;
  address: string;
  blockchain: string;
  arcSmartWalletAddress?: string;
  name?: string;
  metadata?: Record<string, any>;
}

export interface UserWalletState {
  userId: string;
  activeWalletId: string | null;
  wallets: UserWallet[];
}

export class WalletManagerError extends Error {
  constructor(
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'WalletManagerError';
  }
}

/**
 * In-memory wallet storage (replace with real DB in production)
 * 
 * Example migration targets:
 * - PostgreSQL with Prisma
 * - MongoDB
 * - Supabase
 * - Firebase Firestore
 */
class WalletStore {
  private readonly STORAGE_KEY = 'novavault-wallet-manager';
  private readonly USER_WALLETS_KEY = 'novavault-user-wallets';
  private readonly ACTIVE_WALLETS_KEY = 'novavault-active-wallets';

  // Load data from localStorage with fallback to empty structures
  private loadWallets(): Map<string, UserWallet> {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        return new Map(Object.entries(parsed));
      }
    } catch (error) {
      console.warn('[WalletStore] Failed to load wallets from storage:', error);
    }
    return new Map();
  }

  private loadUserWallets(): Map<string, Set<string>> {
    try {
      const data = localStorage.getItem(this.USER_WALLETS_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        const result = new Map();
        for (const [userId, walletIds] of Object.entries(parsed)) {
          result.set(userId, new Set(walletIds as string[]));
        }
        return result;
      }
    } catch (error) {
      console.warn('[WalletStore] Failed to load user wallets from storage:', error);
    }
    return new Map();
  }

  private loadActiveWallets(): Map<string, string> {
    try {
      const data = localStorage.getItem(this.ACTIVE_WALLETS_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        return new Map(Object.entries(parsed));
      }
    } catch (error) {
      console.warn('[WalletStore] Failed to load active wallets from storage:', error);
    }
    return new Map();
  }

  // Persist data to localStorage
  private saveWallets(wallets: Map<string, UserWallet>): void {
    try {
      const data = Object.fromEntries(wallets);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('[WalletStore] Failed to save wallets to storage:', error);
    }
  }

  private saveUserWallets(userWallets: Map<string, Set<string>>): void {
    try {
      const data: Record<string, string[]> = {};
      for (const [userId, walletIds] of userWallets) {
        data[userId] = Array.from(walletIds);
      }
      localStorage.setItem(this.USER_WALLETS_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('[WalletStore] Failed to save user wallets to storage:', error);
    }
  }

  private saveActiveWallets(activeWallets: Map<string, string>): void {
    try {
      const data = Object.fromEntries(activeWallets);
      localStorage.setItem(this.ACTIVE_WALLETS_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('[WalletStore] Failed to save active wallets to storage:', error);
    }
  }

  // Initialize with persistent data
  private wallets: Map<string, UserWallet> = this.loadWallets();
  private userWallets: Map<string, Set<string>> = this.loadUserWallets();
  private activeWallets: Map<string, string> = this.loadActiveWallets();

  constructor() {
    console.log(`[WalletStore] 🔄 Initialized with ${this.wallets.size} persisted wallets`);
    if (this.wallets.size > 0) {
      console.log('[WalletStore] ✅ Found existing wallets in storage:', Array.from(this.wallets.keys()));
    }
  }

  // Clear all storage (for debugging/reset)
  clearAllStorage(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    localStorage.removeItem(this.USER_WALLETS_KEY);
    localStorage.removeItem(this.ACTIVE_WALLETS_KEY);
    this.wallets.clear();
    this.userWallets.clear();
    this.activeWallets.clear();
    console.log('[WalletStore] 🧹 All wallet storage cleared');
  }

  async create(wallet: UserWallet): Promise<UserWallet> {
    // Add to wallets
    this.wallets.set(wallet.id, wallet);
    this.saveWallets(this.wallets);
    
    // Add to user mappings
    if (!this.userWallets.has(wallet.userId)) {
      this.userWallets.set(wallet.userId, new Set());
    }
    this.userWallets.get(wallet.userId)!.add(wallet.id);
    this.saveUserWallets(this.userWallets);

    // Set as active if specified
    if (wallet.isActive) {
      this.activeWallets.set(wallet.userId, wallet.id);
      this.saveActiveWallets(this.activeWallets);
    }

    console.log(`[WalletStore] ✅ Wallet persisted: ${wallet.id} for user ${wallet.userId}`);
    return wallet;
  }

  async findById(id: string): Promise<UserWallet | null> {
    return this.wallets.get(id) || null;
  }

  async findByUserId(userId: string): Promise<UserWallet[]> {
    const walletIds = this.userWallets.get(userId);
    if (!walletIds) return [];

    return Array.from(walletIds)
      .map((id) => this.wallets.get(id))
      .filter((w): w is UserWallet => w !== undefined);
  }

  async findActiveByUserId(userId: string): Promise<UserWallet | null> {
    const activeWalletId = this.activeWallets.get(userId);
    if (!activeWalletId) return null;

    return this.wallets.get(activeWalletId) || null;
  }

  async update(id: string, updates: Partial<UserWallet>): Promise<UserWallet | null> {
    const wallet = this.wallets.get(id);
    if (!wallet) return null;

    const updatedWallet = {
      ...wallet,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    this.wallets.set(id, updatedWallet);
    this.saveWallets(this.wallets);

    if (updates.isActive && wallet.userId) {
      this.activeWallets.set(wallet.userId, id);
      this.saveActiveWallets(this.activeWallets);
    }

    console.log(`[WalletStore] ✅ Wallet updated and persisted: ${id}`);
    return updatedWallet;
  }

  async setActiveWallet(userId: string, walletId: string): Promise<boolean> {
    const wallet = this.wallets.get(walletId);
    if (!wallet || wallet.userId !== userId) {
      return false;
    }

    // Deactivate all wallets for this user
    const userWalletIds = this.userWallets.get(userId);
    if (userWalletIds) {
      for (const id of userWalletIds) {
        const w = this.wallets.get(id);
        if (w) {
          w.isActive = false;
          w.updatedAt = new Date().toISOString();
        }
      }
    }

    // Activate the selected wallet
    wallet.isActive = true;
    wallet.updatedAt = new Date().toISOString();
    this.activeWallets.set(userId, walletId);
    
    // Persist all changes
    this.saveWallets(this.wallets);
    this.saveActiveWallets(this.activeWallets);

    console.log(`[WalletStore] ✅ Active wallet updated and persisted: ${walletId} for user ${userId}`);
    return true;
  }

  async delete(id: string): Promise<boolean> {
    const wallet = this.wallets.get(id);
    if (!wallet) return false;

    this.wallets.delete(id);
    this.userWallets.get(wallet.userId)?.delete(id);

    if (this.activeWallets.get(wallet.userId) === id) {
      this.activeWallets.delete(wallet.userId);
    }

    return true;
  }
}

// Singleton store instance
const store = new WalletStore();

/**
 * Wallet Manager
 * 
 * High-level API for managing user wallets
 */
export class WalletManager {
  /**
   * Save a new Circle wallet to user account
   * 
   * @param data - Wallet creation data
   * @returns Created user wallet
   */
  async saveWalletToUser(data: WalletCreateData): Promise<UserWallet> {
    try {
      // Check if user has existing wallets
      const existingWallets = await store.findByUserId(data.userId);
      
      // First wallet is automatically active
      const isActive = existingWallets.length === 0;

      const wallet: UserWallet = {
        id: this.generateWalletId(),
        userId: data.userId,
        circleWalletId: data.circleWalletId,
        address: data.address,
        blockchain: data.blockchain,
        arcSmartWalletAddress: data.arcSmartWalletAddress,
        name: data.name || `Wallet ${existingWallets.length + 1}`,
        isActive,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: data.metadata,
      };

      return await store.create(wallet);
    } catch (error) {
      throw new WalletManagerError(
        `Failed to save wallet: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'WALLET_SAVE_FAILED'
      );
    }
  }

  /**
   * Get all wallets for a user
   * 
   * @param userId - User ID
   * @returns Array of user wallets
   */
  async getUserWallets(userId: string): Promise<UserWallet[]> {
    try {
      const wallets = await store.findByUserId(userId);
      
      // Sort by creation date, most recent first
      return wallets.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    } catch (error) {
      throw new WalletManagerError(
        `Failed to fetch user wallets: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'WALLETS_FETCH_FAILED'
      );
    }
  }

  /**
   * Get active wallet for user
   * 
   * @param userId - User ID
   * @returns Active wallet or null
   */
  async getActiveWallet(userId: string): Promise<UserWallet | null> {
    try {
      return await store.findActiveByUserId(userId);
    } catch (error) {
      throw new WalletManagerError(
        `Failed to fetch active wallet: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'ACTIVE_WALLET_FETCH_FAILED'
      );
    }
  }

  /**
   * Set active wallet for user
   * 
   * @param userId - User ID
   * @param walletId - Wallet ID to activate
   * @returns Updated wallet
   */
  async setActiveWallet(userId: string, walletId: string): Promise<UserWallet> {
    try {
      const wallet = await store.findById(walletId);

      if (!wallet) {
        throw new WalletManagerError('Wallet not found', 'WALLET_NOT_FOUND');
      }

      if (wallet.userId !== userId) {
        throw new WalletManagerError(
          'Wallet does not belong to user',
          'UNAUTHORIZED_WALLET_ACCESS'
        );
      }

      const success = await store.setActiveWallet(userId, walletId);

      if (!success) {
        throw new WalletManagerError(
          'Failed to set active wallet',
          'ACTIVE_WALLET_SET_FAILED'
        );
      }

      const updatedWallet = await store.findById(walletId);
      if (!updatedWallet) {
        throw new WalletManagerError('Wallet not found after update', 'WALLET_NOT_FOUND');
      }

      return updatedWallet;
    } catch (error) {
      if (error instanceof WalletManagerError) {
        throw error;
      }
      throw new WalletManagerError(
        `Failed to set active wallet: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'ACTIVE_WALLET_SET_FAILED'
      );
    }
  }

  /**
   * Update wallet metadata
   * 
   * @param walletId - Wallet ID
   * @param updates - Partial wallet updates
   * @returns Updated wallet
   */
  async updateWallet(
    walletId: string,
    updates: Partial<Pick<UserWallet, 'name' | 'arcSmartWalletAddress' | 'metadata'>>
  ): Promise<UserWallet> {
    try {
      const updatedWallet = await store.update(walletId, updates);

      if (!updatedWallet) {
        throw new WalletManagerError('Wallet not found', 'WALLET_NOT_FOUND');
      }

      return updatedWallet;
    } catch (error) {
      if (error instanceof WalletManagerError) {
        throw error;
      }
      throw new WalletManagerError(
        `Failed to update wallet: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'WALLET_UPDATE_FAILED'
      );
    }
  }

  /**
   * Delete wallet
   * 
   * @param walletId - Wallet ID
   * @param userId - User ID for authorization
   */
  async deleteWallet(walletId: string, userId: string): Promise<void> {
    try {
      const wallet = await store.findById(walletId);

      if (!wallet) {
        throw new WalletManagerError('Wallet not found', 'WALLET_NOT_FOUND');
      }

      if (wallet.userId !== userId) {
        throw new WalletManagerError(
          'Wallet does not belong to user',
          'UNAUTHORIZED_WALLET_ACCESS'
        );
      }

      const success = await store.delete(walletId);

      if (!success) {
        throw new WalletManagerError('Failed to delete wallet', 'WALLET_DELETE_FAILED');
      }
    } catch (error) {
      if (error instanceof WalletManagerError) {
        throw error;
      }
      throw new WalletManagerError(
        `Failed to delete wallet: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'WALLET_DELETE_FAILED'
      );
    }
  }

  /**
   * Get wallet by ID
   * 
   * @param walletId - Wallet ID
   * @returns Wallet or null
   */
  async getWalletById(walletId: string): Promise<UserWallet | null> {
    try {
      return await store.findById(walletId);
    } catch (error) {
      throw new WalletManagerError(
        `Failed to fetch wallet: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'WALLET_FETCH_FAILED'
      );
    }
  }

  /**
   * Associate Arc Smart Wallet with Circle Wallet
   * 
   * @param walletId - User wallet ID
   * @param arcAddress - Arc smart wallet address
   */
  async linkArcSmartWallet(walletId: string, arcAddress: string): Promise<UserWallet> {
    return this.updateWallet(walletId, { arcSmartWalletAddress: arcAddress });
  }

  /**
   * Get wallet count for user
   * 
   * @param userId - User ID
   * @returns Wallet count
   */
  async getWalletCount(userId: string): Promise<number> {
    const wallets = await this.getUserWallets(userId);
    return wallets.length;
  }

  /**
   * Check if user has any wallets
   * 
   * @param userId - User ID
   * @returns True if user has wallets
   */
  async hasWallets(userId: string): Promise<boolean> {
    const count = await this.getWalletCount(userId);
    return count > 0;
  }

  /**
   * Clear all persistent wallet storage (for debugging/reset)
   * ⚠️ WARNING: This will permanently delete all wallet data!
   */
  clearAllWalletStorage(): void {
    store.clearAllStorage();
    console.log('[WalletManager] 🧹 All wallet storage cleared via WalletManager');
  }

  /**
   * Get storage statistics
   * @returns Storage usage information
   */
  getStorageInfo(): { 
    walletCount: number; 
    userCount: number; 
    activeWalletsCount: number;
    storageKeys: string[];
  } {
    const storageKeys = ['novavault-wallet-manager', 'novavault-user-wallets', 'novavault-active-wallets'];
    return {
      walletCount: store['wallets']?.size || 0,
      userCount: store['userWallets']?.size || 0, 
      activeWalletsCount: store['activeWallets']?.size || 0,
      storageKeys
    };
  }

  /**
   * Generate unique wallet ID
   * 
   * @returns UUID v4 wallet ID
   */
  private generateWalletId(): string {
    return `wallet_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }
}

// Singleton instance
let walletManager: WalletManager | null = null;

/**
 * Get or create WalletManager singleton instance
 * 
 * @returns WalletManager instance
 */
export function getWalletManager(): WalletManager {
  if (!walletManager) {
    walletManager = new WalletManager();
  }
  return walletManager;
}
