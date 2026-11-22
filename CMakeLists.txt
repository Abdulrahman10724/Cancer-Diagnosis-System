cmake_minimum_required(VERSION 3.10)
project(CancerDiagnosisSystem CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Warnings: -Wall -Wextra on GCC/Clang (Linux and MinGW), /W4 on MSVC
if(MSVC)
    add_compile_options(/W4 /permissive- /D_CRT_SECURE_NO_WARNINGS)
else()
    add_compile_options(-Wall -Wextra)
endif()

# Everything except the HTTP server: models, data structures, loader
add_library(cds_core STATIC
    src/CancerDiagnosisSystem.cpp
    src/DataPreprocessor.cpp
    src/DatasetLoader.cpp
    src/DecisionTreeClassifier.cpp
    src/EvaluationMetrics.cpp
    src/FeatureExtractor.cpp
    src/HashMapper.cpp
    src/Json.cpp
    src/KNNClassifier.cpp
    src/LogisticRegressionModel.cpp
    src/ModelSet.cpp
    src/NaiveBayesClassifier.cpp
    src/Patient.cpp
    src/Sampling.cpp
)
target_include_directories(cds_core PUBLIC headers)

# HTTP server
add_executable(cds_server src/Server.cpp)
target_include_directories(cds_server SYSTEM PRIVATE third_party)
target_link_libraries(cds_server PRIVATE cds_core)

if(WIN32)
    target_link_libraries(cds_server PRIVATE ws2_32)
else()
    find_package(Threads REQUIRED)
    target_link_libraries(cds_server PRIVATE Threads::Threads)
endif()

