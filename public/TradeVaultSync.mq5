//+------------------------------------------------------------------+
//| TradeVaultSync.mq5 - sends every CLOSED position to TradeVault   |
//| Setup: 1) Tools > Options > Expert Advisors > tick               |
//|   "Allow WebRequest for listed URL" and add the Endpoint's       |
//|   origin (e.g. https://xxxx.convex.site)                         |
//|   2) Attach this EA to any chart, paste your API key below.      |
//+------------------------------------------------------------------+
#property copyright "TradeVault"
#property version   "1.00"
#property strict

input string ApiKey   = "";   // Your TradeVault MT5 API key (Settings page)
input string Endpoint = "https://energized-flamingo-853.convex.site/mt5/webhook";
input int    SyncDays = 30;   // On start, back-fill closed trades from the last N days

string Num(double v, int digits) { return DoubleToString(v, digits); }

bool Post(string json)
{
   char data[], result[];
   string headers = "Content-Type: application/json\r\n", resHeaders;
   StringToCharArray(json, data, 0, StringLen(json), CP_UTF8);
   int res = WebRequest("POST", Endpoint, headers, 10000, data, result, resHeaders);
   if(res == -1)
   {
      Print("TradeVaultSync: WebRequest failed (", GetLastError(), "). Allow the URL in Tools > Options > Expert Advisors.");
      return false;
   }
   return (res >= 200 && res < 300);
}

void SendPosition(ulong posId)
{
   if(PositionSelectByTicket(posId)) return;          // still open (partial close) - wait
   if(!HistorySelectByPosition(posId)) return;

   string symbol = ""; string type = "buy";
   double volume = 0, openPrice = 0, closePrice = 0, sl = 0, tp = 0;
   double profit = 0, commission = 0, swap = 0;
   datetime openTime = 0, closeTime = 0;
   bool hasIn = false, hasOut = false;

   int total = HistoryDealsTotal();
   for(int i = 0; i < total; i++)
   {
      ulong d = HistoryDealGetTicket(i);
      long entry = HistoryDealGetInteger(d, DEAL_ENTRY);
      long dtype = HistoryDealGetInteger(d, DEAL_TYPE);
      if(dtype != DEAL_TYPE_BUY && dtype != DEAL_TYPE_SELL) continue;

      profit     += HistoryDealGetDouble(d, DEAL_PROFIT);
      commission += HistoryDealGetDouble(d, DEAL_COMMISSION) + HistoryDealGetDouble(d, DEAL_FEE);
      swap       += HistoryDealGetDouble(d, DEAL_SWAP);

      if(entry == DEAL_ENTRY_IN && !hasIn)
      {
         hasIn = true;
         symbol = HistoryDealGetString(d, DEAL_SYMBOL);
         type = (dtype == DEAL_TYPE_BUY) ? "buy" : "sell";
         volume = HistoryDealGetDouble(d, DEAL_VOLUME);
         openPrice = HistoryDealGetDouble(d, DEAL_PRICE);
         openTime = (datetime)HistoryDealGetInteger(d, DEAL_TIME);
      }
      else if(entry == DEAL_ENTRY_OUT || entry == DEAL_ENTRY_OUT_BY || entry == DEAL_ENTRY_INOUT)
      {
         hasOut = true;
         closePrice = HistoryDealGetDouble(d, DEAL_PRICE);
         closeTime = (datetime)HistoryDealGetInteger(d, DEAL_TIME);
         sl = HistoryDealGetDouble(d, DEAL_SL);
         tp = HistoryDealGetDouble(d, DEAL_TP);
      }
   }
   if(!hasIn || !hasOut) return;

   int dg = (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS);
   string json = "{";
   json += "\"apiKey\":\"" + ApiKey + "\",";
   json += "\"ticket\":\"" + (string)posId + "\",";
   json += "\"symbol\":\"" + symbol + "\",";
   json += "\"type\":\"" + type + "\",";
   json += "\"volume\":" + Num(volume, 2) + ",";
   json += "\"openPrice\":" + Num(openPrice, dg) + ",";
   json += "\"closePrice\":" + Num(closePrice, dg) + ",";
   json += "\"openTime\":" + (string)(long)openTime + ",";
   json += "\"closeTime\":" + (string)(long)closeTime + ",";
   json += "\"sl\":" + Num(sl, dg) + ",";
   json += "\"tp\":" + Num(tp, dg) + ",";
   json += "\"profit\":" + Num(profit, 2) + ",";
   json += "\"commission\":" + Num(commission, 2) + ",";
   json += "\"swap\":" + Num(swap, 2);
   json += "}";
   Post(json);
}

int OnInit()
{
   if(ApiKey == "") { Alert("TradeVaultSync: paste your API key in the EA inputs."); return INIT_PARAMETERS_INCORRECT; }
   if(SyncDays > 0 && HistorySelect(TimeCurrent() - (datetime)SyncDays * 86400, TimeCurrent() + 86400))
   {
      ulong ids[]; int n = 0;
      int total = HistoryDealsTotal();
      for(int i = 0; i < total; i++)
      {
         ulong d = HistoryDealGetTicket(i);
         long entry = HistoryDealGetInteger(d, DEAL_ENTRY);
         if(entry == DEAL_ENTRY_OUT || entry == DEAL_ENTRY_OUT_BY || entry == DEAL_ENTRY_INOUT)
         {
            ArrayResize(ids, n + 1);
            ids[n++] = (ulong)HistoryDealGetInteger(d, DEAL_POSITION_ID);
         }
      }
      for(int i = 0; i < n; i++) SendPosition(ids[i]);
   }
   Print("TradeVaultSync active.");
   return INIT_SUCCEEDED;
}

void OnTradeTransaction(const MqlTradeTransaction &trans, const MqlTradeRequest &request, const MqlTradeResult &result)
{
   if(trans.type != TRADE_TRANSACTION_DEAL_ADD) return;
   if(!HistoryDealSelect(trans.deal)) return;
   long entry = HistoryDealGetInteger(trans.deal, DEAL_ENTRY);
   if(entry != DEAL_ENTRY_OUT && entry != DEAL_ENTRY_OUT_BY && entry != DEAL_ENTRY_INOUT) return;
   SendPosition((ulong)HistoryDealGetInteger(trans.deal, DEAL_POSITION_ID));
}
//+------------------------------------------------------------------+
