/**
 * Wallet Storage Debug Utilities
 * 
 * Global helper functions for debugging wallet persistence in browser console.
 * Call these functions from browser DevTools console to check wallet storage.
 */

// Declare walletDebug on Window interface
declare global {
  interface Window {
    walletDebug: {
      checkStorage: () => void;
      clearStorage: () => void;
      exportWallets: () => any;
      importWallets: (backupData: any) => void;
      help: () => void;
    };
  }
}

// Make these functions available globally in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  window.walletDebug = {
    
    /**
     * Check wallet storage status
     */
    checkStorage() {
      console.log('🔍 Wallet Storage Debug Info:');
      console.log('=================================');
      
      // Check localStorage keys
      const keys = ['novavault-wallet-manager', 'novavault-user-wallets', 'novavault-active-wallets', 'novavault-wallets'];
      
      keys.forEach(key => {
        const data = localStorage.getItem(key);
        if (data) {
          try {
            const parsed = JSON.parse(data);
            console.log(`✅ ${key}:`, parsed);
            
            if (key === 'novavault-wallet-manager') {
              const walletCount = Object.keys(parsed).length;
              console.log(`   📊 Stored wallets: ${walletCount}`);
            }
          } catch (e) {
            console.log(`⚠️ ${key}: Invalid JSON`);
          }
        } else {
          console.log(`❌ ${key}: Not found`);
        }
      });
    },
    
    /**
     * Clear all wallet storage (WARNING: Destructive!)
     */
    clearStorage() {
      if (confirm('⚠️ This will DELETE ALL your wallet data! Are you sure?')) {
        const keys = ['novavault-wallet-manager', 'novavault-user-wallets', 'novavault-active-wallets', 'novavault-wallets'];
        keys.forEach(key => localStorage.removeItem(key));
        console.log('🧹 All wallet storage cleared!');
        location.reload(); // Reload to refresh app state
      }
    },
    
    /**
     * Export wallet data for backup
     */
    exportWallets() {
      const backup: Record<string, any> = {};
      const keys = ['novavault-wallet-manager', 'novavault-user-wallets', 'novavault-active-wallets', 'novavault-wallets'];
      
      keys.forEach(key => {
        const data = localStorage.getItem(key);
        if (data) {
          backup[key] = JSON.parse(data);
        }
      });
      
      console.log('💾 Wallet Backup Data:', backup);
      
      // Copy to clipboard if possible
      if (navigator.clipboard) {
        navigator.clipboard.writeText(JSON.stringify(backup, null, 2))
          .then(() => console.log('📋 Backup copied to clipboard!'))
          .catch(() => console.log('❌ Could not copy to clipboard'));
      }
      
      return backup;
    },
    
    /**
     * Import wallet data from backup
     */
    importWallets(backupData) {
      try {
        Object.entries(backupData).forEach(([key, value]) => {
          localStorage.setItem(key, JSON.stringify(value));
        });
        
        console.log('✅ Wallet data imported successfully!');
        location.reload(); // Reload to refresh app state
      } catch (error) {
        console.error('❌ Failed to import wallet data:', error);
      }
    },
    
    /**
     * Show help
     */
    help() {
      console.log('🛠️ Wallet Debug Commands:');
      console.log('=========================');
      console.log('walletDebug.checkStorage()     - Check current storage');
      console.log('walletDebug.clearStorage()     - Clear all storage (⚠️ destructive)');
      console.log('walletDebug.exportWallets()    - Export wallet data');
      console.log('walletDebug.importWallets(data) - Import wallet data');
      console.log('walletDebug.help()             - Show this help');
      console.log('');
      console.log('💡 Tips:');
      console.log('• Your wallets are now stored in localStorage');
      console.log('• They will persist across browser restarts');
      console.log('• Check Application tab > Local Storage in DevTools');
    }
  };
  
  console.log('🛠️ Wallet debug utilities loaded! Type walletDebug.help() for commands.');
}

export {};