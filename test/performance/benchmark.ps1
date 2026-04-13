$baseUrl = "http://localhost:4004/api/inbox"
$headers = @{ Authorization = "Basic dGVzdDp0ZXN0" }

Write-Host ""
Write-Host "=============================================="
Write-Host "  PERFORMANCE BENCHMARK: Inbox Data Loading"
Write-Host "=============================================="
Write-Host ""

# Test 1: Task list - cold cache
Write-Host "--- Test 1: Task List (COLD cache) ---"
$sw = [System.Diagnostics.Stopwatch]::StartNew()
$r = Invoke-WebRequest -Uri "$baseUrl/tasks?top=5" -Headers $headers -UseBasicParsing
$sw.Stop()
Write-Host "  Status: $($r.StatusCode) | Time: $($sw.ElapsedMilliseconds)ms | Payload: $($r.Content.Length) bytes"

# Test 2: Task list - warm cache
Write-Host ""
Write-Host "--- Test 2: Task List (WARM cache - same page) ---"
$sw2 = [System.Diagnostics.Stopwatch]::StartNew()
$r2 = Invoke-WebRequest -Uri "$baseUrl/tasks?top=5" -Headers $headers -UseBasicParsing
$sw2.Stop()
Write-Host "  Status: $($r2.StatusCode) | Time: $($sw2.ElapsedMilliseconds)ms | Payload: $($r2.Content.Length) bytes"

# Test 3: Task list - third call
Write-Host ""
Write-Host "--- Test 3: Task List (3rd call - confirm cache) ---"
$sw3 = [System.Diagnostics.Stopwatch]::StartNew()
$r3 = Invoke-WebRequest -Uri "$baseUrl/tasks?top=5" -Headers $headers -UseBasicParsing
$sw3.Stop()
Write-Host "  Status: $($r3.StatusCode) | Time: $($sw3.ElapsedMilliseconds)ms"

# Test 4: Task detail - cold
Write-Host ""
Write-Host "--- Test 4: Task Information (COLD) ---"
$sw4 = [System.Diagnostics.Stopwatch]::StartNew()
$r4 = Invoke-WebRequest -Uri "$baseUrl/tasks/TASK-PR-001/information" -Headers $headers -UseBasicParsing
$sw4.Stop()
Write-Host "  Status: $($r4.StatusCode) | Time: $($sw4.ElapsedMilliseconds)ms"

# Test 5: Same task detail - warm cache
Write-Host ""
Write-Host "--- Test 5: Task Information (WARM - cached enrichment) ---"
$sw5 = [System.Diagnostics.Stopwatch]::StartNew()
$r5 = Invoke-WebRequest -Uri "$baseUrl/tasks/TASK-PR-001/information" -Headers $headers -UseBasicParsing
$sw5.Stop()
Write-Host "  Status: $($r5.StatusCode) | Time: $($sw5.ElapsedMilliseconds)ms"

# Test 6: Page 2
Write-Host ""
Write-Host "--- Test 6: Task List Page 2 (cache cross-page) ---"
$sw6 = [System.Diagnostics.Stopwatch]::StartNew()
$r6 = Invoke-WebRequest -Uri "$baseUrl/tasks?top=5&skip=5" -Headers $headers -UseBasicParsing
$sw6.Stop()
Write-Host "  Status: $($r6.StatusCode) | Time: $($sw6.ElapsedMilliseconds)ms"

# Test 7: Full detail bundle
Write-Host ""
Write-Host "--- Test 7: Full Task Detail Bundle (COLD) ---"
$sw7 = [System.Diagnostics.Stopwatch]::StartNew()
$r7 = Invoke-WebRequest -Uri "$baseUrl/tasks/TASK-PR-001" -Headers $headers -UseBasicParsing
$sw7.Stop()
Write-Host "  Status: $($r7.StatusCode) | Time: $($sw7.ElapsedMilliseconds)ms"

# Test 8: Full detail bundle - warm
Write-Host ""
Write-Host "--- Test 8: Full Task Detail Bundle (WARM) ---"
$sw8 = [System.Diagnostics.Stopwatch]::StartNew()
$r8 = Invoke-WebRequest -Uri "$baseUrl/tasks/TASK-PR-001" -Headers $headers -UseBasicParsing
$sw8.Stop()
Write-Host "  Status: $($r8.StatusCode) | Time: $($sw8.ElapsedMilliseconds)ms"

# Summary
Write-Host ""
Write-Host "=============================================="
Write-Host "  SUMMARY"
Write-Host "=============================================="
Write-Host "  Task List (cold):     $($sw.ElapsedMilliseconds)ms"
Write-Host "  Task List (warm):     $($sw2.ElapsedMilliseconds)ms  <-- cache hit"
Write-Host "  Task List (3rd):      $($sw3.ElapsedMilliseconds)ms  <-- cache hit"
Write-Host "  Task Info (cold):     $($sw4.ElapsedMilliseconds)ms"
Write-Host "  Task Info (warm):     $($sw5.ElapsedMilliseconds)ms  <-- cache hit"
Write-Host "  Task List Page 2:     $($sw6.ElapsedMilliseconds)ms"
Write-Host "  Detail Bundle (cold): $($sw7.ElapsedMilliseconds)ms"
Write-Host "  Detail Bundle (warm): $($sw8.ElapsedMilliseconds)ms  <-- cache hit"
Write-Host ""

$improvement = [math]::Round((1 - $sw2.ElapsedMilliseconds / $sw.ElapsedMilliseconds) * 100, 1)
Write-Host "  Cache improvement (list): ${improvement}% faster on 2nd call"
$improvement2 = [math]::Round((1 - $sw5.ElapsedMilliseconds / $sw4.ElapsedMilliseconds) * 100, 1)
Write-Host "  Cache improvement (info): ${improvement2}% faster on 2nd call"
$improvement3 = [math]::Round((1 - $sw8.ElapsedMilliseconds / $sw7.ElapsedMilliseconds) * 100, 1)
Write-Host "  Cache improvement (detail): ${improvement3}% faster on 2nd call"
Write-Host "=============================================="
