#!/usr/bin/env bash
# Set POSE_LLM_* on drinkanddraw Coolify application and redeploy.
# Usage: POSE_LLM_API_KEY_B64=$(printf '%s' "sk-..." | base64 -w0) bash set-pose-llm-env.sh
# Or:    POSE_LLM_API_KEY=sk-... bash set-pose-llm-env.sh

set -euo pipefail

if [[ -n "${POSE_LLM_API_KEY_B64:-}" ]]; then
  POSE_LLM_API_KEY="$(printf '%s' "$POSE_LLM_API_KEY_B64" | base64 -d)"
fi

KEY="${POSE_LLM_API_KEY:-}"
BASE_URL="${POSE_LLM_BASE_URL:-https://api.deepseek.com/v1}"
MODEL="${POSE_LLM_MODEL:-deepseek-chat}"
APP_UUID="${COOLIFY_APP_UUID:-ob87a74x8ubsbztx6wtdeiep}"

if [[ -z "$KEY" ]]; then
  echo "ERROR: set POSE_LLM_API_KEY or POSE_LLM_API_KEY_B64"
  exit 1
fi

docker exec \
  -e POSE_LLM_API_KEY="$KEY" \
  -e POSE_LLM_BASE_URL="$BASE_URL" \
  -e POSE_LLM_MODEL="$MODEL" \
  -e APP_UUID="$APP_UUID" \
  coolify php -r '
require "/var/www/html/vendor/autoload.php";
$app = require_once "/var/www/html/bootstrap/app.php";
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\Application;
use App\Models\EnvironmentVariable;

$application = Application::where("uuid", getenv("APP_UUID"))->firstOrFail();
$appId = $application->id;
$vars = [
  "POSE_LLM_API_KEY" => getenv("POSE_LLM_API_KEY"),
  "POSE_LLM_BASE_URL" => getenv("POSE_LLM_BASE_URL"),
  "POSE_LLM_MODEL" => getenv("POSE_LLM_MODEL"),
];

EnvironmentVariable::where("resourceable_type", Application::class)
  ->where("resourceable_id", $appId)
  ->whereIn("key", array_keys($vars))
  ->delete();

foreach ($vars as $k => $v) {
  EnvironmentVariable::create([
    "key" => $k,
    "value" => $v,
    "resourceable_type" => Application::class,
    "resourceable_id" => $appId,
    "is_runtime" => true,
    "is_buildtime" => false,
    "is_preview" => false,
    "is_literal" => true,
  ]);
}
echo "updated env for application id=$appId\n";
'

TOKEN=$(docker exec coolify php -r '
require "/var/www/html/vendor/autoload.php";
$app = require_once "/var/www/html/bootstrap/app.php";
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$user = App\Models\User::first();
$plain = Illuminate\Support\Str::random(64);
$hash = hash("sha256", $plain);
$access = $user->tokens()->create(["name" => "set-pose-llm-env", "token" => $hash, "abilities" => ["*"], "team_id" => 0]);
echo $access->id . "|" . $plain;
' | tr -d '\r')

HTTP=$(curl -sS -o /tmp/coolify-pose-env.json -w "%{http_code}" -X POST "http://127.0.0.1:8000/api/v1/deploy" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d "{\"uuid\":\"$APP_UUID\",\"force\":true}")
echo "redeploy HTTP $HTTP"
cat /tmp/coolify-pose-env.json
echo ""
