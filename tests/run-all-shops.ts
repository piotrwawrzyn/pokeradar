import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

/**
 * Runs all shop integration tests and provides a summary.
 */
async function runAllShopTests() {
  const testsDir = path.join(__dirname, 'shops');
  const testFiles = fs.readdirSync(testsDir).filter(f => f.endsWith('.test.ts'));

  console.log('🧪 Running Shop Integration Tests');
  console.log('='.repeat(50));
  console.log('');

  const results: { shop: string; passed: boolean; output: string }[] = [];

  for (const testFile of testFiles) {
    const shopName = testFile.replace('.test.ts', '');
    const testPath = path.join(testsDir, testFile);

    console.log(`Testing ${shopName}...`);

    try {
      const output = await runTest(testPath);
      results.push({ shop: shopName, passed: true, output });
      console.log(`✅ ${shopName} - PASSED\n`);
    } catch (error) {
      results.push({
        shop: shopName,
        passed: false,
        output: error instanceof Error ? error.message : String(error)
      });
      console.log(`❌ ${shopName} - FAILED\n`);
    }
  }

  // Print summary
  console.log('='.repeat(50));
  console.log('📊 Test Summary');
  console.log('='.repeat(50));

  const passedCount = results.filter(r => r.passed).length;
  const totalCount = results.length;

  results.forEach(result => {
    const icon = result.passed ? '✅' : '❌';
    console.log(`${icon} ${result.shop}`);
  });

  console.log('');
  console.log(`Passed: ${passedCount}/${totalCount} shops`);
  console.log('');

  if (passedCount < totalCount) {
    process.exit(1);
  }
}

function runTest(testPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [
      '--import',
      'tsx',
      '--test',
      testPath
    ], {
      stdio: 'pipe',
      shell: true
    });

    let output = '';
    let errorOutput = '';

    child.stdout?.on('data', (data) => {
      const str = data.toString();
      output += str;
      process.stdout.write(str);
    });

    child.stderr?.on('data', (data) => {
      const str = data.toString();
      errorOutput += str;
      process.stderr.write(str);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve(output);
      } else {
        reject(new Error(errorOutput || `Test failed with exit code ${code}`));
      }
    });

    child.on('error', (error) => {
      reject(error);
    });
  });
}

// Run the tests
runAllShopTests().catch(error => {
  console.error('Error running tests:', error);
  process.exit(1);
});
