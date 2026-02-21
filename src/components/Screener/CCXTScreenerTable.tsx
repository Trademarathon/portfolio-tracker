"use client";

import { useState, useMemo } from 'react';
import { useCCXTScreener, type CCXTMarketData } from '@/hooks/useCCXTScreener';
import { formatCurrency, cn } from '@/lib/utils';
import { TokenIcon } from '@/components/ui/TokenIcon';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, RefreshCw, AlertCircle, TrendingUp, TrendingDown, Minus } from 'lucide-react';

const exchangeColors: Record<string, string> = {
  binance: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  bybit: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  hyperliquid: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
};

const getExchangeColor = (exchange: string) => {
  return exchangeColors[exchange.toLowerCase()] || 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20';
};

const getChangeIcon = (change: number) => {
  if (change > 0) return <TrendingUp className="h-4 w-4 text-green-500" />;
  if (change < 0) return <TrendingDown className="h-4 w-4 text-red-500" />;
  return <Minus className="h-4 w-4 text-gray-500" />;
};

export function CCXTScreenerTable() {
  const { data, errors, loading } = useCCXTScreener();
  const [search, setSearch] = useState('');
  const [selectedExchange, setSelectedExchange] = useState('all');
  const [sortField, setSortField] = useState<keyof CCXTMarketData>('momentumScore');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Filter and sort data
  const filteredData = useMemo(() => {
    const result = data.filter(item => {
      const matchesSearch = search === '' || 
        item.symbol.toLowerCase().includes(search.toLowerCase()) ||
        item.base?.toLowerCase().includes(search.toLowerCase()) ||
        item.exchange.toLowerCase().includes(search.toLowerCase());
      
      const matchesExchange = selectedExchange === 'all' || item.exchange === selectedExchange;
      
      return matchesSearch && matchesExchange;
    });

    // Sorting
    result.sort((a, b) => {
      const aVal = a[sortField] || 0;
      const bVal = b[sortField] || 0;
      
      if (sortDirection === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    return result;
  }, [data, search, selectedExchange, sortField, sortDirection]);

  const handleSort = (field: keyof CCXTMarketData) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const uniqueExchanges = useMemo(() => {
    const exchanges = new Set(data.map(item => item.exchange));
    return ['all', ...Array.from(exchanges)];
  }, [data]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading market data from exchanges...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">CCXT Live Screener</h2>
          <p className="text-muted-foreground">
            Real-time market data from Binance, Bybit, and Hyperliquid via CCXT
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Error Display */}
      {errors.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <div>
                <p className="font-medium text-red-800">Exchange Connection Errors</p>
                <ul className="text-sm text-red-700 mt-1 space-y-1">
                  {errors.map(error => (
                    <li key={error.exchange}>
                      <span className="font-medium">{error.exchange}:</span> {error.message}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by symbol, base, or exchange..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div className="w-full md:w-48">
              <Select value={selectedExchange} onValueChange={setSelectedExchange}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by exchange" />
                </SelectTrigger>
                <SelectContent>
                  {uniqueExchanges.map(exchange => (
                    <SelectItem key={exchange} value={exchange}>
                      <div className="flex items-center gap-2">
                        {exchange === 'all' ? (
                          <>All Exchanges</>
                        ) : (
                          <>
                            <div className={cn('h-2 w-2 rounded-full', getExchangeColor(exchange).split(' ')[1])} />
                            {exchange.charAt(0).toUpperCase() + exchange.slice(1)}
                          </>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2 mt-4">
            <Button
              variant={sortField === 'momentumScore' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleSort('momentumScore')}
            >
              Momentum {sortField === 'momentumScore' && (sortDirection === 'desc' ? '↓' : '↑')}
            </Button>
            <Button
              variant={sortField === 'change24h' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleSort('change24h')}
            >
              24h Change {sortField === 'change24h' && (sortDirection === 'desc' ? '↓' : '↑')}
            </Button>
            <Button
              variant={sortField === 'volume24h' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleSort('volume24h')}
            >
              Volume {sortField === 'volume24h' && (sortDirection === 'desc' ? '↓' : '↑')}
            </Button>
            <Button
              variant={sortField === 'fundingRate' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleSort('fundingRate')}
            >
              Funding {sortField === 'fundingRate' && (sortDirection === 'desc' ? '↓' : '↑')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Markets ({filteredData.length})</span>
            {filteredData.length > 0 && (
              <span className="text-sm font-normal text-muted-foreground">
                Updated every 10 seconds
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredData.length === 0 ? (
            <div className="text-center py-12">
              <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium">No markets found</h3>
              <p className="text-muted-foreground mt-2">
                Try adjusting your search or filter settings
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Exchange</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">24h Change</TableHead>
                    <TableHead className="text-right">24h Volume</TableHead>
                    <TableHead className="text-right">Funding Rate</TableHead>
                    <TableHead className="text-right">Open Interest</TableHead>
                    <TableHead className="text-right">Momentum</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.slice(0, 100).map((item) => {
                    const [base, quote] = item.symbol.split('/');
                    const tokenSymbol = base || item.symbol.split('/')[0] || item.symbol;
                    
                    return (
                      <TableRow key={`${item.symbol}-${item.exchange}`}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <TokenIcon symbol={tokenSymbol} className="h-6 w-6" />
                            <div>
                              <div className="font-medium">{tokenSymbol}</div>
                              <div className="text-xs text-muted-foreground">
                                {quote || 'PERP'}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={getExchangeColor(item.exchange)}>
                            {String(item.exchange || '').toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(item.price)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            {getChangeIcon(item.change24h || 0)}
                            <span className={cn(
                              'font-medium',
                              (item.change24h || 0) > 0 ? 'text-green-600' : 
                              (item.change24h || 0) < 0 ? 'text-red-600' : 'text-gray-600'
                            )}>
                              {item.change24h ? (item.change24h > 0 ? '+' : '') + item.change24h.toFixed(2) + '%' : '0.00%'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(item.volume24h, 'USD')}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={cn(
                            'font-medium',
                            (item.fundingRate || 0) > 0.0001 ? 'text-green-600' :
                            (item.fundingRate || 0) < -0.0001 ? 'text-red-600' : 'text-gray-600'
                          )}>
                            {((item.fundingRate || 0) * 100).toFixed(4)}%
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          {item.openInterest ? formatCurrency(item.openInterest, 'USD') : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {getChangeIcon(item.momentumScore || 0)}
                            <span className={cn(
                              'font-medium',
                              (item.momentumScore || 0) > 0 ? 'text-green-600' : 
                              (item.momentumScore || 0) < 0 ? 'text-red-600' : 'text-gray-600'
                            )}>
                              {(item.momentumScore || 0).toFixed(2)}
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats Footer */}
      {filteredData.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm text-muted-foreground">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">{filteredData.length}</div>
            <div>Total Markets</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {filteredData.filter(d => (d.change24h || 0) > 0).length}
            </div>
            <div>24h Gainers</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">
              {filteredData.filter(d => (d.change24h || 0) < 0).length}
            </div>
            <div>24h Losers</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-amber-600">
              {filteredData.filter(d => (d.fundingRate || 0) > 0.0001).length}
            </div>
            <div>Positive Funding</div>
          </div>
        </div>
      )}
    </div>
  );
}