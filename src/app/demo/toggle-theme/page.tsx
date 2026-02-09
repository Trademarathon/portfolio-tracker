import { ToggleThemeDemo } from "@/components/demos/ToggleThemeDemo";

export default function ToggleThemePage() {
    return (
        <div className="container mx-auto py-10">
            <h1 className="text-3xl font-bold mb-6">Toggle Theme Component</h1>
            <div className="max-w-md mx-auto">
                <ToggleThemeDemo />
            </div>
        </div>
    );
}
