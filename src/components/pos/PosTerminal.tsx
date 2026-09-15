import React, { useState, useEffect, useRef } from 'react';
import { 
  InventoryItem, 
  CartItem, 
  CustomerMembership, 
  SalesTransaction, 
  SalesTransactionItem,
  TimedMarkdownRule,
  UserProfile 
} from '../../types';
import { 
  Barcode, 
  Camera, 
  Search, 
  ShoppingCart, 
  Trash2, 
  Plus, 
  Minus, 
  Percent, 
  CreditCard, 
  Banknote, 
  QrCode, 
  Clock, 
  ShieldCheck, 
  RotateCcw, 
  CheckCircle2, 
  AlertCircle, 
  History, 
  Sparkles, 
  UserCheck, 
  XCircle,
  Tag,
  Store,
  Layers
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  collection, 
  getDocs, 
  doc, 
  runTransaction, 
  serverTimestamp,
  addDoc
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { toast } from 'sonner';
import { soundEffects } from '../../lib/audio';
import { SupervisorGateModal } from './SupervisorGateModal';
import { MembershipModal } from './MembershipModal';
import { ReceiptModal } from './ReceiptModal';
import { ReceiptHistoryModal } from './ReceiptHistoryModal';
import { CameraScannerModal } from './CameraScannerModal';

interface PosTerminalProps {
  profile: UserProfile | null;
}

// Default Clearance Markdown Rules (e.g., 20:00 to 22:00 evening markdown of 20%)
const DEFAULT_MARKDOWN_RULE: TimedMarkdownRule = {
  id: 'rule_evening_clearance',
  name: 'Evening Clearance Window',
  startHour: 20, // 8 PM
  endHour: 22,   // 10 PM
  discountPercent: 20,
  targetTag: 'clearance',
  isActive: true,
  description: '20% off all clearance & perishable goods during evening hours',
};

export const PosTerminal: React.FC<PosTerminalProps> = ({ profile }) => {
  // Inventory Items State
  const [catalog, setCatalog] = useState<InventoryItem[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Basket / Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [attachedMember, setAttachedMember] = useState<CustomerMembership | null>(null);

  // Timed Markdown State
  const [markdownRule, setMarkdownRule] = useState<TimedMarkdownRule>(DEFAULT_MARKDOWN_RULE);
  const [isMarkdownSimulated, setIsMarkdownSimulated] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  // Payment & Checkout State
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'qr_pay' | 'credit'>('cash');
  const [amountTendered, setAmountTendered] = useState<string>('');
  const [isCheckingOut, setIsCheckingOut] = useState<boolean>(false);

  // Modals State
  const [isCameraOpen, setIsCameraOpen] = useState<boolean>(false);
  const [isMembershipOpen, setIsMembershipOpen] = useState<boolean>(false);
  const [isSupervisorOpen, setIsSupervisorOpen] = useState<boolean>(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  const [itemForSupervisor, setItemForSupervisor] = useState<CartItem | null>(null);

  // Receipt Modal
  const [completedTransaction, setCompletedTransaction] = useState<SalesTransaction | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState<boolean>(false);

  // Barcode buffer for continuous hardware USB/Bluetooth scanner
  const barcodeBufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Clock tick every 30 seconds for timed markdowns
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  // Listen to Firestore for live manager-configured markdown windows
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'markdownRules'), (snapshot) => {
      if (snapshot.exists()) {
        const liveRule = snapshot.data() as TimedMarkdownRule;
        setMarkdownRule(prev => ({
          ...prev,
          ...liveRule,
        }));
      }
    });
    return () => unsub();
  }, []);

  // Fetch Inventory Catalog on mount
  useEffect(() => {
    loadInventory();
  }, []);

  // Hardware Scanner Global Keyboard Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is intentionally typing in an input or textarea (except when barcode fast sequence is detected)
      const target = e.target as HTMLElement;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT');

      const now = Date.now();
      const elapsed = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      // Scanners transmit keystrokes very fast (<50ms between keys)
      if (e.key === 'Enter') {
        if (barcodeBufferRef.current.length >= 3) {
          const scannedCode = barcodeBufferRef.current.trim();
          barcodeBufferRef.current = '';
          handleBarcodeScanned(scannedCode);
          if (isInput) e.preventDefault();
        }
      } else if (e.key.length === 1) {
        if (elapsed > 100 && !isInput) {
          // Reset buffer if human typing slowly outside input
          barcodeBufferRef.current = e.key;
        } else {
          barcodeBufferRef.current += e.key;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [catalog, cart]);

  const loadInventory = async () => {
    setLoadingCatalog(true);
    try {
      const snap = await getDocs(collection(db, 'items'));
      const itemsList: InventoryItem[] = [];
      snap.forEach((d) => {
        itemsList.push({ id: d.id, ...d.data() } as InventoryItem);
      });

      // If catalog has very few or no items, seed enterprise retail items
      if (itemsList.length < 5) {
        const sampleRetailItems: Omit<InventoryItem, 'id'>[] = [
          {
            sku: 'SKU-BEV-001',
            barcode: '880100101',
            name: 'Artisan Cold Brew Coffee (330ml)',
            category: 'Beverages',
            description: 'Single-origin Ethiopian cold brew bottle',
            unit: 'btl',
            currentStock: 48,
            minStock: 10,
            unitPrice: 4.50,
            tags: ['clearance', 'perishable'],
            isMarkdownEligible: true,
            lastUpdated: serverTimestamp(),
          },
          {
            sku: 'SKU-BEV-002',
            barcode: '880100102',
            name: 'Organic Sparkling Matcha Green Tea',
            category: 'Beverages',
            description: 'Ceremonial grade sparkling matcha with yuzu',
            unit: 'can',
            currentStock: 64,
            minStock: 12,
            unitPrice: 3.75,
            tags: ['beverages'],
            isMarkdownEligible: false,
            lastUpdated: serverTimestamp(),
          },
          {
            sku: 'SKU-BAK-001',
            barcode: '880100201',
            name: 'Fresh Butter Croissant (Twin Pack)',
            category: 'Bakery',
            description: 'Freshly baked French sourdough butter croissants',
            unit: 'pack',
            currentStock: 25,
            minStock: 5,
            unitPrice: 5.20,
            tags: ['clearance', 'perishable'],
            isMarkdownEligible: true,
            lastUpdated: serverTimestamp(),
          },
          {
            sku: 'SKU-BAK-002',
            barcode: '880100202',
            name: 'Dark Chocolate Hazelnut Babka',
            category: 'Bakery',
            description: 'Braided brioche with 70% dark Belgian cocoa',
            unit: 'loaf',
            currentStock: 18,
            minStock: 4,
            unitPrice: 8.50,
            tags: ['clearance', 'perishable'],
            isMarkdownEligible: true,
            lastUpdated: serverTimestamp(),
          },
          {
            sku: 'SKU-GRO-001',
            barcode: '880100301',
            name: 'Extra Virgin Olive Oil (Cold Pressed 500ml)',
            category: 'Grocery',
            description: 'Kalamata estate cold-extracted olive oil',
            unit: 'btl',
            currentStock: 32,
            minStock: 8,
            unitPrice: 14.90,
            tags: ['pantry', 'premium'],
            isMarkdownEligible: false,
            lastUpdated: serverTimestamp(),
          },
          {
            sku: 'SKU-GRO-002',
            barcode: '880100302',
            name: 'Organic Quinoa & Ancient Grains (1kg)',
            category: 'Grocery',
            description: 'Tri-color organic royal Bolivian quinoa',
            unit: 'kg',
            currentStock: 40,
            minStock: 10,
            unitPrice: 9.80,
            tags: ['organic', 'clearance'],
            isMarkdownEligible: true,
            lastUpdated: serverTimestamp(),
          },
          {
            sku: 'SKU-ELE-001',
            barcode: '880100401',
            name: 'USB-C Braided Fast Charge Cable (2m)',
            category: 'Electronics',
            description: '100W PD nylon braided durable charging cable',
            unit: 'pcs',
            currentStock: 50,
            minStock: 15,
            unitPrice: 12.00,
            tags: ['accessories'],
            isMarkdownEligible: false,
            lastUpdated: serverTimestamp(),
          },
          {
            sku: 'SKU-HOU-001',
            barcode: '880100501',
            name: 'Eco Bamboo Fibre Kitchen Towels (4-pk)',
            category: 'Household',
            description: 'Super absorbent reusable unbleached bamboo rolls',
            unit: 'pack',
            currentStock: 30,
            minStock: 6,
            unitPrice: 6.90,
            tags: ['eco', 'household'],
            isMarkdownEligible: false,
            lastUpdated: serverTimestamp(),
          },
        ];

        for (const item of sampleRetailItems) {
          const docRef = await addDoc(collection(db, 'items'), item);
          itemsList.push({ id: docRef.id, ...item });
        }
      }

      setCatalog(itemsList);
    } catch (err) {
      console.error('Failed to load inventory for POS', err);
      toast.error('Unable to fetch retail catalog from Firestore.');
    } finally {
      setLoadingCatalog(false);
    }
  };

  // Determine if Timed Markdown Window is active
  const currentHour = currentTime.getHours();
  const isRealTimeWindowActive =
    markdownRule.isActive &&
    currentHour >= markdownRule.startHour &&
    currentHour < markdownRule.endHour;

  const isMarkdownActive = isMarkdownSimulated || isRealTimeWindowActive;

  // Add Item to Basket with pricing, markdown, and member calculations
  const addItemToCart = (item: InventoryItem, overrideQty = 1) => {
    if (item.currentStock <= 0) {
      soundEffects.playAlertBuzz();
      toast.error(`${item.name} is OUT OF STOCK!`);
      return;
    }

    const basePrice = item.unitPrice || 0;
    const isCategoryMatched = 
      markdownRule.targetCategories && markdownRule.targetCategories.length > 0
        ? markdownRule.targetCategories.includes(item.category)
        : false;
    const isEligibleForMarkdown = isMarkdownActive && (
      item.isMarkdownEligible || 
      (markdownRule.targetTag && item.tags?.includes(markdownRule.targetTag)) ||
      isCategoryMatched
    );
    const markdownDiscountRate = isEligibleForMarkdown ? (markdownRule.discountPercent / 100) : 0;
    const memberDiscountRate = attachedMember ? (attachedMember.discountPercent / 100) : 0;

    // Highest automated promo discount applies
    const bestDiscountRate = Math.max(markdownDiscountRate, memberDiscountRate);
    const unitDiscount = basePrice * bestDiscountRate;
    const effectivePrice = Math.max(0, basePrice - unitDiscount);

    setCart((prevCart) => {
      const existingIndex = prevCart.findIndex((c) => c.id === item.id);
      if (existingIndex > -1) {
        const existing = prevCart[existingIndex];
        const newQty = existing.quantity + overrideQty;

        if (newQty > item.currentStock) {
          soundEffects.playAlertBuzz();
          toast.warning(`Maximum available stock reached (${item.currentStock} ${item.unit})`);
          return prevCart;
        }

        const updated = [...prevCart];
        const lineDiscount = existing.priceOverridden ? existing.discount : (unitDiscount * newQty);
        const lineUnitPrice = existing.priceOverridden ? existing.unitPrice : effectivePrice;

        updated[existingIndex] = {
          ...existing,
          quantity: newQty,
          discount: lineDiscount,
          total: lineUnitPrice * newQty,
        };
        return updated;
      } else {
        const newCartItem: CartItem = {
          id: item.id,
          sku: item.sku,
          name: item.name,
          barcode: item.barcode,
          unit: item.unit,
          currentStock: item.currentStock,
          originalPrice: basePrice,
          unitPrice: effectivePrice,
          quantity: overrideQty,
          discount: unitDiscount * overrideQty,
          markdownApplied: isEligibleForMarkdown && markdownDiscountRate >= memberDiscountRate,
          markdownPercent: isEligibleForMarkdown ? markdownRule.discountPercent : undefined,
          memberDiscountApplied: !!attachedMember && memberDiscountRate > markdownDiscountRate,
          total: effectivePrice * overrideQty,
        };
        return [newCartItem, ...prevCart];
      }
    });

    soundEffects.playScanBeep();
    toast.success(`Scanned: ${item.name}`, { duration: 1500 });
  };

  // Barcode / SKU scan handler
  const handleBarcodeScanned = (scannedCode: string) => {
    const clean = scannedCode.trim().toLowerCase();
    const matched = catalog.find(
      (it) =>
        it.barcode?.toLowerCase() === clean ||
        it.sku.toLowerCase() === clean ||
        it.name.toLowerCase().includes(clean)
    );

    if (matched) {
      addItemToCart(matched);
      setSearchQuery('');
    } else {
      soundEffects.playAlertBuzz();
      toast.error(`Barcode/SKU "${scannedCode}" not found in inventory catalog.`);
    }
  };

  // Re-calculate cart pricing when Member or Markdown status changes
  useEffect(() => {
    if (cart.length === 0) return;

    setCart((prevCart) =>
      prevCart.map((c) => {
        if (c.priceOverridden) return c; // keep supervisor authorized price

        const matchedItem = catalog.find((it) => it.id === c.id);
        const basePrice = c.originalPrice;
        const isEligibleForMarkdown = isMarkdownActive && (matchedItem?.isMarkdownEligible || matchedItem?.tags?.includes(markdownRule.targetTag));
        const markdownRate = isEligibleForMarkdown ? (markdownRule.discountPercent / 100) : 0;
        const memberRate = attachedMember ? (attachedMember.discountPercent / 100) : 0;

        const bestRate = Math.max(markdownRate, memberRate);
        const unitDiscount = basePrice * bestRate;
        const effectivePrice = Math.max(0, basePrice - unitDiscount);

        return {
          ...c,
          unitPrice: effectivePrice,
          discount: unitDiscount * c.quantity,
          markdownApplied: isEligibleForMarkdown && markdownRate >= memberRate,
          markdownPercent: isEligibleForMarkdown ? markdownRule.discountPercent : undefined,
          memberDiscountApplied: !!attachedMember && memberRate > markdownRate,
          total: effectivePrice * c.quantity,
        };
      })
    );
  }, [isMarkdownActive, attachedMember]);

  // Adjust quantity
  const updateQuantity = (itemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((it) => {
          if (it.id === itemId) {
            const nextQty = it.quantity + delta;
            if (nextQty <= 0) return null;
            if (nextQty > it.currentStock) {
              soundEffects.playAlertBuzz();
              toast.warning(`Stock limit reached (${it.currentStock} ${it.unit})`);
              return it;
            }
            const unitDiscount = it.priceOverridden ? 0 : (it.originalPrice - it.unitPrice);
            return {
              ...it,
              quantity: nextQty,
              discount: unitDiscount * nextQty,
              total: it.unitPrice * nextQty,
            };
          }
          return it;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  // Remove single line item
  const removeFromCart = (itemId: string) => {
    setCart((prev) => prev.filter((it) => it.id !== itemId));
    toast.info('Item removed from basket');
  };

  // Clear entire cart
  const clearCart = () => {
    if (cart.length === 0) return;
    setCart([]);
    setAmountTendered('');
    toast.info('Basket cleared');
  };

  // Apply Supervisor Price Override
  const handleSupervisorAuthorized = (newPrice: number, supervisor: string, reason: string) => {
    if (!itemForSupervisor) return;

    setCart((prev) =>
      prev.map((it) => {
        if (it.id === itemForSupervisor.id) {
          const totalDiscount = Math.max(0, it.originalPrice - newPrice) * it.quantity;
          return {
            ...it,
            unitPrice: newPrice,
            priceOverridden: true,
            overrideSupervisor: supervisor,
            overrideReason: reason,
            discount: totalDiscount,
            total: newPrice * it.quantity,
          };
        }
        return it;
      })
    );
    setItemForSupervisor(null);
  };

  // Financial Calculations
  const rawSubtotal = cart.reduce((sum, item) => sum + (item.originalPrice * item.quantity), 0);
  const totalDiscounts = cart.reduce((sum, item) => sum + item.discount, 0);
  const netSubtotal = cart.reduce((sum, item) => sum + item.total, 0);

  // Markdown savings vs member savings breakdown
  const markdownSavings = cart
    .filter((it) => it.markdownApplied)
    .reduce((sum, it) => sum + it.discount, 0);
  const memberSavings = cart
    .filter((it) => it.memberDiscountApplied)
    .reduce((sum, it) => sum + it.discount, 0);

  const taxRate = 0.06; // 6.0% Retail Sales Tax
  const tax = netSubtotal * taxRate;
  const grandTotal = netSubtotal + tax;

  // Tendered and change calculations
  const numericTendered = parseFloat(amountTendered) || 0;
  const changeDue = Math.max(0, numericTendered - grandTotal);
  const pointsToEarn = Math.floor(grandTotal);

  // Quick cash tender helper
  const handleQuickCash = (amount: number) => {
    setPaymentMethod('cash');
    setAmountTendered(amount.toString());
  };

  // ATOMIC CHECKOUT ENGINE WITH FIRESTORE TRANSACTION
  const handleCheckout = async () => {
    if (cart.length === 0) {
      toast.warning('Cart is empty. Scan items first.');
      return;
    }

    if (paymentMethod === 'cash' && numericTendered < grandTotal) {
      soundEffects.playAlertBuzz();
      toast.error(`Insufficient cash tendered. Total is $${grandTotal.toFixed(2)}.`);
      return;
    }

    setIsCheckingOut(true);
    try {
      const txNumber = `TX-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

      // Execute atomic Firestore transaction
      await runTransaction(db, async (transaction) => {
        // Step 1: Read all item docs to verify stock
        const itemDocs: { ref: any; currentStock: number; id: string; name: string }[] = [];
        for (const item of cart) {
          const itemRef = doc(db, 'items', item.id);
          const itemSnap = await transaction.get(itemRef);
          if (!itemSnap.exists()) {
            throw new Error(`Inventory item ${item.name} not found in database.`);
          }
          const stock = itemSnap.data().currentStock || 0;
          if (stock < item.quantity) {
            throw new Error(`Insufficient stock for ${item.name}. Remaining: ${stock}, Requested: ${item.quantity}`);
          }
          itemDocs.push({ ref: itemRef, currentStock: stock, id: item.id, name: item.name });
        }

        // Step 2: If customer membership attached, read member doc
        let memberRef: any = null;
        let memberCurrentPoints = 0;
        if (attachedMember) {
          memberRef = doc(db, 'memberships', attachedMember.id);
          const memberSnap = await transaction.get(memberRef);
          if (memberSnap.exists()) {
            const mData = memberSnap.data() as { points?: number };
            memberCurrentPoints = mData?.points || 0;
          }
        }

        // Step 3: Deduct stock from each item doc
        for (const it of cart) {
          const matched = itemDocs.find((d) => d.id === it.id);
          if (matched) {
            transaction.update(matched.ref, {
              currentStock: matched.currentStock - it.quantity,
              lastSold: serverTimestamp(),
            });
          }
        }

        // Step 4: Add points to member if attached
        if (memberRef) {
          transaction.update(memberRef, {
            points: memberCurrentPoints + pointsToEarn,
            lastVisit: serverTimestamp(),
          });
        }

        // Step 5: Log complete Sales Transaction into salesTransactions
        const txDocRef = doc(collection(db, 'salesTransactions'));
        const txData: Omit<SalesTransaction, 'id'> = {
          transactionNumber: txNumber,
          cashierId: profile?.uid || 'CASHIER-01',
          cashierName: profile?.displayName || profile?.email?.split('@')[0] || 'Cashier Station',
          items: cart.map((c) => ({
            itemId: c.id,
            sku: c.sku,
            name: c.name,
            barcode: c.barcode,
            unit: c.unit,
            quantity: c.quantity,
            originalPrice: c.originalPrice,
            unitPrice: c.unitPrice,
            discount: c.discount,
            priceOverridden: c.priceOverridden,
            overrideSupervisor: c.overrideSupervisor,
            total: c.total,
          })),
          subtotal: netSubtotal,
          discounts: totalDiscounts,
          markdownDiscount: markdownSavings,
          memberDiscount: memberSavings,
          tax: tax,
          total: grandTotal,
          paymentMethod: paymentMethod,
          amountTendered: paymentMethod === 'cash' ? numericTendered : grandTotal,
          changeDue: paymentMethod === 'cash' ? changeDue : 0,
          membershipId: attachedMember?.membershipId,
          memberName: attachedMember?.name,
          memberTier: attachedMember?.tier,
          pointsEarned: attachedMember ? pointsToEarn : 0,
          timestamp: new Date().toISOString(),
        };

        transaction.set(txDocRef, {
          ...txData,
          createdAt: serverTimestamp(),
        });
      });

      // Update local state catalog with new stock values
      setCatalog((prevCatalog) =>
        prevCatalog.map((catItem) => {
          const cartItem = cart.find((c) => c.id === catItem.id);
          if (cartItem) {
            return {
              ...catItem,
              currentStock: Math.max(0, catItem.currentStock - cartItem.quantity),
            };
          }
          return catItem;
        })
      );

      // Play chime & prepare completed receipt
      soundEffects.playCheckoutChime();

      const finishedTx: SalesTransaction = {
        id: txNumber,
        transactionNumber: txNumber,
        cashierId: profile?.uid || 'CASHIER-01',
        cashierName: profile?.displayName || profile?.email?.split('@')[0] || 'Cashier Station',
        items: cart.map((c) => ({
          itemId: c.id,
          sku: c.sku,
          name: c.name,
          barcode: c.barcode,
          unit: c.unit,
          quantity: c.quantity,
          originalPrice: c.originalPrice,
          unitPrice: c.unitPrice,
          discount: c.discount,
          priceOverridden: c.priceOverridden,
          overrideSupervisor: c.overrideSupervisor,
          total: c.total,
        })),
        subtotal: netSubtotal,
        discounts: totalDiscounts,
        markdownDiscount: markdownSavings,
        memberDiscount: memberSavings,
        tax: tax,
        total: grandTotal,
        paymentMethod: paymentMethod,
        amountTendered: paymentMethod === 'cash' ? numericTendered : grandTotal,
        changeDue: paymentMethod === 'cash' ? changeDue : 0,
        membershipId: attachedMember?.membershipId,
        memberName: attachedMember?.name,
        memberTier: attachedMember?.tier,
        pointsEarned: attachedMember ? pointsToEarn : 0,
        timestamp: new Date().toISOString(),
      };

      setCompletedTransaction(finishedTx);
      setIsReceiptOpen(true);
      setCart([]);
      setAmountTendered('');
      toast.success(`Transaction ${txNumber} completed successfully!`);

      // Post balanced General Ledger journal & POS order
      try {
        await addDoc(collection(db, 'ledgerJournals'), {
          voucherNumber: `JV-${txNumber}`,
          date: new Date().toISOString().split('T')[0],
          memo: `POS Sales Checkout #${txNumber} (${paymentMethod.toUpperCase()})`,
          sourceType: 'pos_sales',
          entries: [
            { 
              accountCode: '1000', 
              accountName: `1000 - ${paymentMethod === 'cash' ? 'Cash on Hand (Register)' : 'Bank / Card Clearing'}`, 
              debit: grandTotal, 
              credit: 0 
            },
            { 
              accountCode: '4000', 
              accountName: '4000 - Retail Merchandise Sales Revenue', 
              debit: 0, 
              credit: netSubtotal 
            },
            { 
              accountCode: '2100', 
              accountName: '2100 - GST / SST Output Tax Payable', 
              debit: 0, 
              credit: tax 
            },
          ],
          totalAmount: grandTotal,
          createdBy: profile?.displayName || profile?.email || 'POS Register',
          createdAt: serverTimestamp(),
        });

        // Also record to posOrders
        await addDoc(collection(db, 'posOrders'), {
          ...finishedTx,
          createdAt: serverTimestamp(),
        });
      } catch (postErr) {
        console.warn('Accounting ledger hook warning:', postErr);
      }
    } catch (err: any) {
      console.error('Checkout error:', err);
      soundEffects.playAlertBuzz();
      toast.error(err.message || 'Checkout failed due to database conflict. Please try again.');
    } finally {
      setIsCheckingOut(false);
    }
  };

  // Filter Catalog
  const categories = ['all', ...new Set(catalog.map((i) => i.category).filter(Boolean))];
  const filteredCatalog = catalog.filter((it) => {
    const matchesCat = selectedCategory === 'all' || it.category.toLowerCase() === selectedCategory.toLowerCase();
    const q = searchQuery.toLowerCase().trim();
    if (!q) return matchesCat;
    const matchesQuery =
      it.name.toLowerCase().includes(q) ||
      it.sku.toLowerCase().includes(q) ||
      it.barcode?.toLowerCase().includes(q) ||
      it.category.toLowerCase().includes(q);
    return matchesCat && matchesQuery;
  });

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 overflow-hidden select-none">
      {/* 1. POS Terminal Header & Live Clearance Window Banner */}
      <header className="px-4 py-3 bg-slate-900 border-b border-slate-800 shrink-0 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold shadow-md shadow-blue-600/10">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-white tracking-tight">POS Terminal Register #01</h1>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Online
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Cashier: <span className="text-slate-200 font-semibold">{profile?.displayName || profile?.email}</span> • Shift Active
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Membership Button */}
            <Button
              onClick={() => setIsMembershipOpen(true)}
              variant="outline"
              size="sm"
              className={`border text-xs flex items-center gap-1.5 h-9 ${
                attachedMember
                  ? 'bg-purple-950/80 border-purple-500 text-purple-200 hover:bg-purple-900'
                  : 'bg-slate-800/80 border-slate-700 text-slate-200 hover:bg-slate-800'
              }`}
            >
              <CreditCard className="w-4 h-4 text-purple-400" />
              {attachedMember ? (
                <span className="font-bold">{attachedMember.name} ({attachedMember.tier})</span>
              ) : (
                <span>Customer Loyalty Card</span>
              )}
            </Button>

            {/* Camera Barcode Scanner */}
            <Button
              onClick={() => setIsCameraOpen(true)}
              variant="outline"
              size="sm"
              className="bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 text-xs flex items-center gap-1.5 h-9"
            >
              <Camera className="w-4 h-4 text-blue-400" />
              <span>Camera Scan</span>
            </Button>

            {/* History / Reprint */}
            <Button
              onClick={() => setIsHistoryOpen(true)}
              variant="outline"
              size="sm"
              className="bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 text-xs flex items-center gap-1.5 h-9"
            >
              <History className="w-4 h-4 text-slate-400" />
              <span>Receipt Archive</span>
            </Button>
          </div>
        </div>

        {/* Timed Markdown Clearance Notification Bar */}
        <div className={`px-3 py-1.5 rounded-xl border flex flex-wrap items-center justify-between gap-2 text-xs transition-colors ${
          isMarkdownActive
            ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200'
            : 'bg-slate-950/80 border-slate-800 text-slate-400'
        }`}>
          <div className="flex items-center gap-2">
            <Clock className={`w-4 h-4 ${isMarkdownActive ? 'text-emerald-400 animate-spin-slow' : 'text-slate-500'}`} />
            <span>
              <strong>{markdownRule.name} ({markdownRule.startHour}:00 - {markdownRule.endHour}:00):</strong>{' '}
              {markdownRule.discountPercent}% OFF clearance & perishable items.
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
              isMarkdownActive 
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' 
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}>
              {isMarkdownActive ? 'CLEARANCE ACTIVE' : 'SCHEDULED'}
            </span>

            {/* Markdown Simulator Toggle for Quick Testing */}
            <button
              onClick={() => {
                setIsMarkdownSimulated(!isMarkdownSimulated);
                toast.info(`Markdown Clearance Window manually ${!isMarkdownSimulated ? 'ACTIVATED' : 'DEACTIVATED'}`);
              }}
              className="text-[11px] underline text-blue-400 hover:text-blue-300 transition-colors"
            >
              {isMarkdownSimulated ? 'Disable Simulation' : 'Simulate Clearance Window'}
            </button>
          </div>
        </div>
      </header>

      {/* 2. Main Work Area: Split Grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-0 overflow-hidden">
        {/* Left Column: Product Catalog & Fast Scanner Search (7 cols on lg) */}
        <div className="lg:col-span-7 flex flex-col border-r border-slate-800/80 bg-slate-950/50 overflow-hidden">
          {/* Search & Hardware Scanner Input */}
          <div className="p-3 border-b border-slate-800 bg-slate-900/60 flex items-center gap-2">
            <div className="relative flex-1">
              <Barcode className="w-5 h-5 text-blue-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                ref={searchInputRef}
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchQuery.trim()) {
                    handleBarcodeScanned(searchQuery.trim());
                  }
                }}
                placeholder="Scan barcode, enter SKU, or search products (Press Enter)..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-slate-500 font-medium focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-inner"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              )}
            </div>

            <Button
              onClick={() => {
                if (searchQuery.trim()) {
                  handleBarcodeScanned(searchQuery.trim());
                }
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-4 h-10 shadow-sm"
            >
              Add
            </Button>
          </div>

          {/* Category Filter Pills */}
          <div className="px-3 py-2 border-b border-slate-800/80 bg-slate-900/30 flex items-center gap-1.5 overflow-x-auto custom-scrollbar shrink-0">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap capitalize transition-colors ${
                  selectedCategory === cat
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white border border-slate-800'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Product Cards Grid */}
          <div className="flex-1 p-3 overflow-y-auto custom-scrollbar">
            {loadingCatalog ? (
              <div className="flex flex-col items-center justify-center h-64 text-slate-400 text-sm">
                <Layers className="w-8 h-8 text-blue-500 animate-spin mb-2" />
                <span>Loading Retail Inventory...</span>
              </div>
            ) : filteredCatalog.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-slate-500 text-sm">
                <AlertCircle className="w-8 h-8 text-slate-600 mb-2" />
                <span>No products found matching &ldquo;{searchQuery}&rdquo;</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5">
                {filteredCatalog.map((prod) => {
                  const isLow = prod.currentStock <= prod.minStock;
                  const isOut = prod.currentStock <= 0;
                  const isMarkdownEligible = isMarkdownActive && (prod.isMarkdownEligible || prod.tags?.includes(markdownRule.targetTag));
                  const effectiveUnitPrice = isMarkdownEligible 
                    ? (prod.unitPrice || 0) * (1 - markdownRule.discountPercent / 100) 
                    : (prod.unitPrice || 0);

                  return (
                    <div
                      key={prod.id}
                      onClick={() => !isOut && addItemToCart(prod)}
                      className={`p-3 rounded-xl border transition-all flex flex-col justify-between text-left group relative ${
                        isOut
                          ? 'bg-slate-900/40 border-slate-800 opacity-50 cursor-not-allowed'
                          : 'bg-slate-900/90 border-slate-800/80 hover:border-blue-500/70 hover:bg-slate-900 cursor-pointer shadow-sm hover:shadow-md'
                      }`}
                    >
                      {/* Top Badges */}
                      <div className="flex items-center justify-between gap-1 mb-1.5">
                        <span className="text-[10px] font-mono font-medium text-slate-400 truncate">
                          {prod.sku}
                        </span>
                        {isMarkdownEligible && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-0.5">
                            <Tag className="w-2.5 h-2.5" />
                            -{markdownRule.discountPercent}%
                          </span>
                        )}
                      </div>

                      {/* Product Title */}
                      <div className="font-semibold text-xs text-white group-hover:text-blue-300 transition-colors line-clamp-2 mb-2 leading-snug">
                        {prod.name}
                      </div>

                      {/* Pricing & Stock */}
                      <div className="pt-2 border-t border-slate-800/60 flex items-end justify-between">
                        <div>
                          {isMarkdownEligible ? (
                            <div className="flex flex-col">
                              <span className="text-[10px] text-slate-500 line-through font-mono">
                                ${(prod.unitPrice || 0).toFixed(2)}
                              </span>
                              <span className="text-sm font-bold font-mono text-emerald-400">
                                ${effectiveUnitPrice.toFixed(2)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-sm font-bold font-mono text-white">
                              ${(prod.unitPrice || 0).toFixed(2)}
                            </span>
                          )}
                        </div>

                        <div className="text-right">
                          <span className={`text-[10px] font-medium block ${
                            isOut ? 'text-rose-400' : isLow ? 'text-amber-400' : 'text-slate-400'
                          }`}>
                            {isOut ? 'Out of Stock' : `${prod.currentStock} ${prod.unit}`}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Active Cart Basket & Checkout Module (5 cols on lg) */}
        <div className="lg:col-span-5 flex flex-col bg-slate-900 border-l border-slate-800 overflow-hidden">
          {/* Basket Header */}
          <div className="p-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-blue-400" />
              <span className="font-bold text-sm text-white">Active Basket</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-blue-600 text-white">
                {cart.reduce((acc, c) => acc + c.quantity, 0)}
              </span>
            </div>

            {cart.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearCart}
                className="text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 h-7 px-2"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" />
                Clear
              </Button>
            )}
          </div>

          {/* Attached Membership Banner in Cart */}
          {attachedMember && (
            <div className="px-3 py-2 bg-purple-950/30 border-b border-purple-500/30 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 truncate">
                <Sparkles className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                <span className="text-purple-200 truncate">
                  Loyalty Member: <strong>{attachedMember.name}</strong> ({attachedMember.tier} • {attachedMember.discountPercent}% OFF)
                </span>
              </div>
              <button
                onClick={() => setAttachedMember(null)}
                className="text-[10px] text-purple-400 hover:text-white underline ml-2 shrink-0"
              >
                Detach
              </button>
            </div>
          )}

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-slate-500 text-xs text-center p-6 space-y-2">
                <ShoppingCart className="w-10 h-10 text-slate-700 stroke-[1.5]" />
                <p className="font-medium text-slate-400">Basket is currently empty</p>
                <p className="text-slate-500 max-w-xs">
                  Scan barcode with hardware scanner, trigger camera scanner, or click items on the left to add.
                </p>
              </div>
            ) : (
              cart.map((item) => (
                <div
                  key={item.id}
                  className="p-2.5 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-xs text-white truncate leading-tight">
                        {item.name}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono flex items-center gap-2 mt-0.5">
                        <span>SKU: {item.sku}</span>
                        {item.priceOverridden && (
                          <span className="text-amber-400 font-semibold flex items-center gap-0.5">
                            <ShieldCheck className="w-3 h-3" />
                            Overridden
                          </span>
                        )}
                        {item.markdownApplied && (
                          <span className="text-emerald-400 font-semibold">Clearance Applied</span>
                        )}
                        {item.memberDiscountApplied && (
                          <span className="text-purple-400 font-semibold">Loyalty Applied</span>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-bold text-sm font-mono text-white">
                        ${item.total.toFixed(2)}
                      </div>
                      {item.discount > 0 && (
                        <div className="text-[10px] text-emerald-400 font-mono">
                          Saved -${item.discount.toFixed(2)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Controls: Quantity & Supervisor Price Override */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-900 text-xs">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => updateQuantity(item.id, -1)}
                        className="w-6 h-6 rounded-md bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center transition-colors"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-8 text-center font-mono font-bold text-sm text-white">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.id, 1)}
                        className="w-6 h-6 rounded-md bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Supervisor Override Gate Trigger */}
                      <button
                        onClick={() => {
                          setItemForSupervisor(item);
                          setIsSupervisorOpen(true);
                        }}
                        className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 transition-colors"
                        title="Authorize Supervisor Unit Price Override"
                      >
                        <ShieldCheck className="w-3 h-3" />
                        <span>${item.unitPrice.toFixed(2)}</span>
                      </button>

                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="text-slate-500 hover:text-rose-400 p-1 transition-colors"
                        title="Remove item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Financial Calculation & Checkout Section */}
          <div className="p-3 border-t border-slate-800 bg-slate-950 space-y-3 shrink-0">
            {/* Calculation rows */}
            <div className="space-y-1 text-xs text-slate-400">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="font-mono text-slate-200">${rawSubtotal.toFixed(2)}</span>
              </div>
              {markdownSavings > 0 && (
                <div className="flex justify-between text-emerald-400">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Timed Clearance Savings
                  </span>
                  <span className="font-mono">-${markdownSavings.toFixed(2)}</span>
                </div>
              )}
              {memberSavings > 0 && (
                <div className="flex justify-between text-purple-400">
                  <span className="flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    Loyalty Member Savings
                  </span>
                  <span className="font-mono">-${memberSavings.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Sales Tax (6.0%)</span>
                <span className="font-mono text-slate-200">${tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-white pt-1 border-t border-slate-800">
                <span>Total Amount Due</span>
                <span className="text-xl font-mono text-blue-400">${grandTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Payment Mode Selector */}
            <div className="grid grid-cols-4 gap-1 pt-1">
              {[
                { id: 'cash', label: 'Cash', icon: Banknote },
                { id: 'card', label: 'Card EMV', icon: CreditCard },
                { id: 'qr_pay', label: 'QR Pay', icon: QrCode },
                { id: 'credit', label: 'Credit', icon: UserCheck },
              ].map((m) => {
                const Icon = m.icon;
                const isSelected = paymentMethod === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => setPaymentMethod(m.id as any)}
                    className={`py-1.5 px-2 rounded-lg text-xs font-semibold flex flex-col items-center gap-1 transition-all border ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{m.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Cash Tendered & Quick Cash Options */}
            {paymentMethod === 'cash' && (
              <div className="space-y-2 p-2 rounded-xl bg-slate-900 border border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-medium">Tendered:</span>
                  <div className="relative flex-1">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-sm">$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={amountTendered}
                      onChange={(e) => setAmountTendered(e.target.value)}
                      placeholder={grandTotal.toFixed(2)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-6 pr-3 py-1.5 text-sm font-mono font-bold text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  {numericTendered >= grandTotal && grandTotal > 0 && (
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block">Change:</span>
                      <span className="text-xs font-mono font-bold text-emerald-400">
                        ${changeDue.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Quick denomination pills */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleQuickCash(Math.ceil(grandTotal))}
                    className="flex-1 py-1 rounded bg-slate-800 text-[11px] font-mono text-slate-300 hover:bg-slate-700 border border-slate-700"
                  >
                    Exact
                  </button>
                  <button
                    onClick={() => handleQuickCash(20)}
                    className="flex-1 py-1 rounded bg-slate-800 text-[11px] font-mono text-slate-300 hover:bg-slate-700 border border-slate-700"
                  >
                    $20
                  </button>
                  <button
                    onClick={() => handleQuickCash(50)}
                    className="flex-1 py-1 rounded bg-slate-800 text-[11px] font-mono text-slate-300 hover:bg-slate-700 border border-slate-700"
                  >
                    $50
                  </button>
                  <button
                    onClick={() => handleQuickCash(100)}
                    className="flex-1 py-1 rounded bg-slate-800 text-[11px] font-mono text-slate-300 hover:bg-slate-700 border border-slate-700"
                  >
                    $100
                  </button>
                </div>
              </div>
            )}

            {/* Complete Sale Button */}
            <Button
              onClick={handleCheckout}
              disabled={isCheckingOut || cart.length === 0}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm py-3 h-12 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all"
            >
              {isCheckingOut ? (
                <>
                  <Layers className="w-4 h-4 animate-spin" />
                  <span>Processing Atomic Transaction...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
                  <span>Complete Sale & Print Receipt (${grandTotal.toFixed(2)})</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* MODALS */}
      {/* 1. Camera Barcode Scanner Modal */}
      <CameraScannerModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onScan={(barcode) => {
          handleBarcodeScanned(barcode);
          setIsCameraOpen(false);
        }}
      />

      {/* 2. Customer Loyalty Membership Modal */}
      <MembershipModal
        isOpen={isMembershipOpen}
        activeMember={attachedMember}
        onClose={() => setIsMembershipOpen(false)}
        onSelectMember={(m) => setAttachedMember(m)}
      />

      {/* 3. Supervisor Security Gate Override Modal */}
      <SupervisorGateModal
        isOpen={isSupervisorOpen}
        item={itemForSupervisor}
        currentUser={profile}
        onClose={() => {
          setIsSupervisorOpen(false);
          setItemForSupervisor(null);
        }}
        onAuthorizeOverride={handleSupervisorAuthorized}
      />

      {/* 4. Thermal Printable Receipt Modal */}
      <ReceiptModal
        isOpen={isReceiptOpen}
        transaction={completedTransaction}
        onClose={() => setIsReceiptOpen(false)}
        onNewSale={() => {
          setIsReceiptOpen(false);
          setCompletedTransaction(null);
          searchInputRef.current?.focus();
        }}
      />

      {/* 5. Sales Transactions Archive & Re-print Modal */}
      <ReceiptHistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        onSelectReceipt={(tx) => {
          setCompletedTransaction(tx);
          setIsReceiptOpen(true);
        }}
      />
    </div>
  );
};
