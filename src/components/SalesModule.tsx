import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  serverTimestamp 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { UserProfile, SalesOrder, Customer, InventoryItem, SalesOrderItem } from '../types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  TrendingUp, 
  ShoppingCart, 
  Users, 
  FileText, 
  Plus, 
  Search, 
  CheckCircle, 
  Clock, 
  DollarSign, 
  Building2,
  Trash2,
  Send
} from 'lucide-react';
import { toast } from 'sonner';

interface SalesModuleProps {
  profile: UserProfile | null;
}

export function SalesModule({ profile }: SalesModuleProps) {
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  
  // Modals
  const [isNewOrderOpen, setIsNewOrderOpen] = useState(false);
  const [isNewCustomerOpen, setIsNewCustomerOpen] = useState(false);
  
  // Filter
  const [orderFilter, setOrderFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // New Order Form state
  const [newOrder, setNewOrder] = useState<{
    customerName: string;
    customerId: string;
    items: SalesOrderItem[];
    notes: string;
  }>({
    customerName: '',
    customerId: '',
    items: [],
    notes: ''
  });

  // Current item builder line
  const [selectedItemId, setSelectedItemId] = useState('');
  const [itemQty, setItemQty] = useState(1);
  const [customPrice, setCustomPrice] = useState(0);

  // New Customer Form state
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    company: '',
    email: '',
    phone: '',
    creditLimit: 10000,
    status: 'active' as const
  });

  useEffect(() => {
    const unsubOrders = onSnapshot(collection(db, 'salesOrders'), (snap) => {
      setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() } as SalesOrder)));
    });
    const unsubCustomers = onSnapshot(collection(db, 'customers'), (snap) => {
      setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Customer)));
    });
    const unsubItems = onSnapshot(collection(db, 'items'), (snap) => {
      setInventoryItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as InventoryItem)));
    });

    return () => {
      unsubOrders();
      unsubCustomers();
      unsubItems();
    };
  }, []);

  // Line item addition to new order
  const handleAddLineItem = () => {
    if (!selectedItemId) {
      toast.error('Select an inventory item');
      return;
    }
    const inv = inventoryItems.find(i => i.id === selectedItemId);
    if (!inv) return;

    const unitPrice = customPrice > 0 ? customPrice : (inv.unitPrice || 100);
    const lineItem: SalesOrderItem = {
      itemId: inv.id,
      itemName: inv.name,
      sku: inv.sku,
      quantity: itemQty,
      unitPrice,
      total: itemQty * unitPrice
    };

    setNewOrder(prev => ({
      ...prev,
      items: [...prev.items, lineItem]
    }));

    setSelectedItemId('');
    setItemQty(1);
    setCustomPrice(0);
  };

  const handleRemoveLineItem = (index: number) => {
    setNewOrder(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const orderTotal = useMemo(() => {
    return newOrder.items.reduce((sum, item) => sum + item.total, 0);
  }, [newOrder.items]);

  const handleCreateOrder = async () => {
    if (!newOrder.customerName) {
      toast.error('Please specify customer');
      return;
    }
    if (newOrder.items.length === 0) {
      toast.error('Add at least one item to this order');
      return;
    }

    try {
      const orderNumber = `SO-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      await addDoc(collection(db, 'salesOrders'), {
        orderNumber,
        customerName: newOrder.customerName,
        customerId: newOrder.customerId || '',
        salesRepId: profile?.uid || '',
        salesRepName: profile?.displayName || profile?.email || 'Sales Rep',
        orderDate: new Date().toISOString().split('T')[0],
        status: 'confirmed',
        items: newOrder.items,
        totalAmount: orderTotal,
        notes: newOrder.notes,
        createdAt: new Date().toISOString()
      });

      toast.success(`Sales Order ${orderNumber} created successfully! Total: $${orderTotal.toLocaleString()}`);
      setIsNewOrderOpen(false);
      setNewOrder({ customerName: '', customerId: '', items: [], notes: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'salesOrders');
    }
  };

  const handleCreateCustomer = async () => {
    if (!newCustomer.name || !newCustomer.company) {
      toast.error('Customer name and company are required');
      return;
    }

    try {
      await addDoc(collection(db, 'customers'), {
        ...newCustomer,
        createdAt: new Date().toISOString()
      });
      toast.success(`Customer ${newCustomer.company} registered`);
      setIsNewCustomerOpen(false);
      setNewCustomer({
        name: '',
        company: '',
        email: '',
        phone: '',
        creditLimit: 10000,
        status: 'active'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'customers');
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, newStatus: SalesOrder['status']) => {
    try {
      await updateDoc(doc(db, 'salesOrders', orderId), { status: newStatus });
      toast.success(`Order status updated to ${newStatus}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'salesOrders');
    }
  };

  // Metrics
  const totalRevenue = orders
    .filter(o => o.status !== 'draft')
    .reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  
  const myOrdersCount = orders.filter(o => o.salesRepId === profile?.uid).length;

  const filteredOrders = orders.filter(o => {
    const matchesFilter = orderFilter === 'ALL' || o.status === orderFilter;
    const matchesSearch = 
      o.orderNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.salesRepName?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Sales & Customer Management</h2>
            <Badge className="bg-blue-600 text-white font-semibold">Sales Hub</Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Track customer sales orders, generate quotations, maintain client accounts, and review performance metrics.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button 
            onClick={() => setIsNewCustomerOpen(true)}
            variant="outline"
            className="gap-2"
          >
            <Building2 className="w-4 h-4 text-blue-600" /> New Customer
          </Button>
          <Button 
            onClick={() => setIsNewOrderOpen(true)}
            className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="w-4 h-4" /> Create Sales Order
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-white border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-2">
            <span className="font-semibold text-slate-800">Total Booked Sales</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 font-mono">
            ${totalRevenue.toLocaleString()}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Across all confirmed deals</p>
        </Card>

        <Card className="p-4 bg-white border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-2">
            <span className="font-semibold text-slate-800">Total Orders</span>
            <ShoppingCart className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900">
            {orders.length}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">{myOrdersCount} closed by you</p>
        </Card>

        <Card className="p-4 bg-white border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-2">
            <span className="font-semibold text-slate-800">Active Clients</span>
            <Users className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900">
            {customers.length}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Registered customer accounts</p>
        </Card>

        <Card className="p-4 bg-white border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-2">
            <span className="font-semibold text-slate-800">My Sales Dept</span>
            <Building2 className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-lg font-bold text-slate-900">
            {profile?.position || 'Sales Representative'}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Rep: {profile?.displayName}</p>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="orders" className="w-full">
        <TabsList className="grid w-full grid-cols-2 lg:w-[400px] bg-slate-100 p-1 rounded-xl">
          <TabsTrigger value="orders" className="gap-1.5 text-xs font-medium">
            <ShoppingCart className="w-3.5 h-3.5" /> Sales Orders
          </TabsTrigger>
          <TabsTrigger value="customers" className="gap-1.5 text-xs font-medium">
            <Building2 className="w-3.5 h-3.5" /> Client Accounts
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: Sales Orders */}
        <TabsContent value="orders" className="space-y-4 pt-2">
          <Card className="border-slate-200 shadow-xs">
            <CardHeader className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base font-semibold">Sales Orders & Quotations</CardTitle>
                <CardDescription className="text-xs">
                  Review incoming purchase orders and customer contracts.
                </CardDescription>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative w-48">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <Input 
                    placeholder="Search orders..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="pl-8 h-8 text-xs bg-white"
                  />
                </div>

                <Select value={orderFilter} onValueChange={setOrderFilter}>
                  <SelectTrigger className="h-8 text-xs w-[130px] bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Statuses</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="dispatched">Dispatched</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="quotation">Quotation</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="text-xs font-semibold">Order #</TableHead>
                    <TableHead className="text-xs font-semibold">Customer</TableHead>
                    <TableHead className="text-xs font-semibold">Sales Representative</TableHead>
                    <TableHead className="text-xs font-semibold">Date</TableHead>
                    <TableHead className="text-xs font-semibold text-right">Total Amount</TableHead>
                    <TableHead className="text-xs font-semibold text-center">Status</TableHead>
                    <TableHead className="text-right text-xs font-semibold pr-4">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-slate-400 text-xs">
                        No sales orders found. Click "Create Sales Order" to record a new deal.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredOrders.map(ord => (
                      <TableRow key={ord.id} className="hover:bg-slate-50/70">
                        <TableCell className="font-mono font-semibold text-xs text-blue-600">
                          {ord.orderNumber}
                        </TableCell>
                        <TableCell className="font-medium text-xs text-slate-900">
                          {ord.customerName}
                        </TableCell>
                        <TableCell className="text-xs text-slate-600">
                          {ord.salesRepName}
                        </TableCell>
                        <TableCell className="text-xs text-slate-500">
                          {ord.orderDate}
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold text-xs text-slate-900">
                          ${(ord.totalAmount || 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge 
                            className={`text-[10px] capitalize ${
                              ord.status === 'confirmed' ? 'bg-blue-100 text-blue-800' :
                              ord.status === 'dispatched' ? 'bg-amber-100 text-amber-800' :
                              ord.status === 'paid' ? 'bg-emerald-100 text-emerald-800' :
                              'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {ord.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right pr-4">
                          <Select 
                            value={ord.status} 
                            onValueChange={(val: any) => handleUpdateOrderStatus(ord.id, val)}
                          >
                            <SelectTrigger className="h-7 text-xs w-[110px] ml-auto">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="quotation">Quotation</SelectItem>
                              <SelectItem value="confirmed">Confirmed</SelectItem>
                              <SelectItem value="dispatched">Dispatched</SelectItem>
                              <SelectItem value="paid">Paid</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: Customers */}
        <TabsContent value="customers" className="space-y-4 pt-2">
          <Card className="border-slate-200 shadow-xs">
            <CardHeader className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Client Directory</CardTitle>
                <CardDescription className="text-xs">
                  Companies and purchasing contacts.
                </CardDescription>
              </div>
              <Button size="sm" onClick={() => setIsNewCustomerOpen(true)} className="gap-1.5 text-xs">
                <Plus className="w-3.5 h-3.5" /> Add Customer
              </Button>
            </CardHeader>

            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="text-xs font-semibold">Company Name</TableHead>
                    <TableHead className="text-xs font-semibold">Contact Person</TableHead>
                    <TableHead className="text-xs font-semibold">Email</TableHead>
                    <TableHead className="text-xs font-semibold">Phone</TableHead>
                    <TableHead className="text-right text-xs font-semibold pr-4">Credit Limit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-slate-400 text-xs">
                        No customer accounts added.
                      </TableCell>
                    </TableRow>
                  ) : (
                    customers.map(c => (
                      <TableRow key={c.id}>
                        <TableCell className="font-semibold text-xs text-slate-900">{c.company}</TableCell>
                        <TableCell className="text-xs text-slate-700">{c.name}</TableCell>
                        <TableCell className="text-xs text-slate-500">{c.email}</TableCell>
                        <TableCell className="text-xs text-slate-500">{c.phone || '-'}</TableCell>
                        <TableCell className="text-right font-mono text-xs font-semibold pr-4">
                          ${(c.creditLimit || 0).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* New Sales Order Modal */}
      <Dialog open={isNewOrderOpen} onOpenChange={setIsNewOrderOpen}>
        <DialogContent className="sm:max-w-[620px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-blue-600" />
              Create Sales Order
            </DialogTitle>
            <DialogDescription>
              Select customer and items to generate a confirmed sales order.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Customer selection */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Customer / Client</label>
              {customers.length > 0 ? (
                <Select 
                  value={newOrder.customerId} 
                  onValueChange={v => {
                    const c = customers.find(cust => cust.id === v);
                    setNewOrder({
                      ...newOrder,
                      customerId: v,
                      customerName: c ? `${c.company} (${c.name})` : ''
                    });
                  }}
                >
                  <SelectTrigger className="w-full bg-white">
                    <SelectValue placeholder="Select existing customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.company} — {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input 
                  placeholder="Enter Customer / Company Name"
                  value={newOrder.customerName}
                  onChange={e => setNewOrder({...newOrder, customerName: e.target.value})}
                  className="bg-white"
                />
              )}
            </div>

            {/* Line items builder */}
            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
              <span className="text-xs font-bold text-slate-800 block">Add Products / Line Items</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="sm:col-span-1 space-y-1">
                  <label className="text-[11px] font-medium text-slate-600">Product</label>
                  <Select 
                    value={selectedItemId} 
                    onValueChange={v => {
                      setSelectedItemId(v);
                      const it = inventoryItems.find(item => item.id === v);
                      if (it?.unitPrice) setCustomPrice(it.unitPrice);
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs bg-white">
                      <SelectValue placeholder="Choose item" />
                    </SelectTrigger>
                    <SelectContent>
                      {inventoryItems.map(item => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name} ({item.currentStock} in stock)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-600">Quantity</label>
                  <Input 
                    type="number"
                    min={1}
                    value={itemQty}
                    onChange={e => setItemQty(parseInt(e.target.value) || 1)}
                    className="h-8 text-xs bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-600">Unit Price ($)</label>
                  <div className="flex gap-1.5">
                    <Input 
                      type="number"
                      value={customPrice}
                      onChange={e => setCustomPrice(parseFloat(e.target.value) || 0)}
                      className="h-8 text-xs bg-white"
                      placeholder="100"
                    />
                    <Button 
                      type="button" 
                      size="sm" 
                      onClick={handleAddLineItem}
                      className="h-8 text-xs shrink-0"
                    >
                      Add
                    </Button>
                  </div>
                </div>
              </div>

              {/* Added Line Items Table */}
              {newOrder.items.length > 0 && (
                <div className="border border-slate-200 rounded-lg overflow-hidden bg-white mt-2">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow className="text-[11px]">
                        <TableHead>Item</TableHead>
                        <TableHead className="text-center">Qty</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="w-8"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {newOrder.items.map((it, idx) => (
                        <TableRow key={idx} className="text-xs">
                          <TableCell className="font-medium py-1.5">{it.itemName}</TableCell>
                          <TableCell className="text-center py-1.5">{it.quantity}</TableCell>
                          <TableCell className="text-right py-1.5">${it.unitPrice.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-bold py-1.5">${it.total.toFixed(2)}</TableCell>
                          <TableCell className="py-1.5 text-center">
                            <button 
                              type="button" 
                              onClick={() => handleRemoveLineItem(idx)}
                              className="text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="p-2.5 bg-slate-50 text-right font-bold text-sm text-slate-900 border-t border-slate-200">
                    Grand Total: ${orderTotal.toLocaleString()}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Remarks / Order Terms</label>
              <Input 
                value={newOrder.notes}
                onChange={e => setNewOrder({...newOrder, notes: e.target.value})}
                placeholder="Payment terms, delivery instructions..."
                className="bg-white"
              />
            </div>
          </div>

          <DialogFooter className="pt-2 border-t border-slate-100">
            <Button variant="outline" onClick={() => setIsNewOrderOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateOrder} disabled={newOrder.items.length === 0} className="gap-1.5 bg-blue-600 hover:bg-blue-700">
              <CheckCircle className="w-4 h-4" /> Confirm Sales Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Customer Modal */}
      <Dialog open={isNewCustomerOpen} onOpenChange={setIsNewCustomerOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Register Customer Account</DialogTitle>
            <DialogDescription>
              Create a new client record in the ERP customer directory.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Company Name</label>
              <Input 
                value={newCustomer.company} 
                onChange={e => setNewCustomer({...newCustomer, company: e.target.value})}
                placeholder="Acme Global Inc."
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Contact Person</label>
                <Input 
                  value={newCustomer.name} 
                  onChange={e => setNewCustomer({...newCustomer, name: e.target.value})}
                  placeholder="John Smith"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Email</label>
                <Input 
                  type="email"
                  value={newCustomer.email} 
                  onChange={e => setNewCustomer({...newCustomer, email: e.target.value})}
                  placeholder="john@acme.com"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Phone</label>
                <Input 
                  value={newCustomer.phone} 
                  onChange={e => setNewCustomer({...newCustomer, phone: e.target.value})}
                  placeholder="+1 555-0199"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Credit Limit ($)</label>
                <Input 
                  type="number"
                  value={newCustomer.creditLimit} 
                  onChange={e => setNewCustomer({...newCustomer, creditLimit: parseInt(e.target.value) || 0})}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewCustomerOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateCustomer}>Save Customer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
