/** @type {import('next').NextConfig} */
const nextConfig = {
    serverExternalPackages: ["sharp", "onnxruntime-node"],
    webpack: (config) => {
        config.resolve.alias = {
            ...config.resolve.alias,
            "sharp$": false,
            "onnxruntime-node$": false,
        }
        return config;
    },
    // Silence Turbopack warning as suggested by Next.js 16 compiler
    turbopack: {}
};

export default nextConfig;
