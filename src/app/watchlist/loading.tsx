export default function WatchlistLoading() {
    return (
        <div className="flex h-[calc(100vh-64px)] items-center justify-center bg-background">
            <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
                <p className="text-xs font-medium text-muted-foreground">Loading Screener...</p>
            </div>
        </div>
    );
}
