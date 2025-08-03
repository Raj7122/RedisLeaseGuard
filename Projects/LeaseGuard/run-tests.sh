#!/bin/bash

# 🚀 LeaseGuard Test Runner Script
# Comprehensive automated testing for LeaseGuard application

echo "🚀 LeaseGuard Test Runner"
echo "=========================="
echo ""

# Function to display menu
show_menu() {
    echo "Select test suite to run:"
    echo "1) Run ALL tests"
    echo "2) E2E Tests (End-to-End)"
    echo "3) API Integration Tests"
    echo "4) UI Component Tests"
    echo "5) Performance & Load Tests"
    echo "6) Unit Tests Only"
    echo "7) Tests with Coverage"
    echo "8) Watch Mode (Development)"
    echo "9) Quick Health Check"
    echo "0) Exit"
    echo ""
}

# Function to run tests with pattern
run_tests() {
    local pattern=$1
    local description=$2
    local coverage=$3
    
    echo "🧪 Running $description..."
    echo "Pattern: $pattern"
    echo ""
    
    if [ "$coverage" = "true" ]; then
        npm test -- --coverage --testPathPatterns="$pattern" --verbose
    else
        npm test -- --testPathPatterns="$pattern" --verbose
    fi
    
    echo ""
    echo "✅ $description completed!"
    echo ""
}

# Function to run health check
health_check() {
    echo "🏥 Running Quick Health Check..."
    echo ""
    
    # Check if Redis is running
    if redis-cli ping > /dev/null 2>&1; then
        echo "✅ Redis is running"
    else
        echo "❌ Redis is not running (start with: brew services start redis)"
    fi
    
    # Check if development server is running
    if curl -s http://localhost:3000 > /dev/null 2>&1; then
        echo "✅ Development server is running"
    else
        echo "❌ Development server is not running (start with: npm run dev)"
    fi
    
    # Check environment variables
    if [ -f ".env.local" ]; then
        echo "✅ Environment file exists"
    else
        echo "❌ Environment file missing (.env.local)"
    fi
    
    echo ""
}

# Main script logic
while true; do
    show_menu
    read -p "Enter your choice (0-9): " choice
    
    case $choice in
        1)
            echo "🔥 Running ALL test suites..."
            echo ""
            run_tests "e2e|api-integration|ui-components|performance-load" "ALL TESTS"
            ;;
        2)
            run_tests "e2e" "E2E Tests"
            ;;
        3)
            run_tests "api-integration" "API Integration Tests"
            ;;
        4)
            run_tests "ui-components" "UI Component Tests"
            ;;
        5)
            run_tests "performance-load" "Performance & Load Tests"
            ;;
        6)
            run_tests "test" "Unit Tests"
            ;;
        7)
            echo "📊 Running tests with coverage..."
            echo ""
            run_tests "e2e|api-integration|ui-components|performance-load" "ALL TESTS WITH COVERAGE" "true"
            ;;
        8)
            echo "👀 Starting watch mode..."
            echo "Press Ctrl+C to stop"
            echo ""
            npm test -- --watch --testPathPatterns="e2e|api-integration|ui-components|performance-load"
            ;;
        9)
            health_check
            ;;
        0)
            echo "👋 Goodbye!"
            exit 0
            ;;
        *)
            echo "❌ Invalid choice. Please enter a number between 0-9."
            echo ""
            ;;
    esac
    
    if [ "$choice" != "8" ] && [ "$choice" != "0" ]; then
        read -p "Press Enter to continue..."
    fi
done 