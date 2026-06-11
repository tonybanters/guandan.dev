// swift-tools-version: 5.7
import PackageDescription

let package = Package(
    name: "GuandanCore",
    platforms: [.iOS(.v15), .macOS(.v12)],
    products: [
        .library(name: "GuandanCore", targets: ["GuandanCore"]),
    ],
    targets: [
        .target(name: "GuandanCore"),
        .testTarget(name: "GuandanCoreTests", dependencies: ["GuandanCore"]),
    ]
)
