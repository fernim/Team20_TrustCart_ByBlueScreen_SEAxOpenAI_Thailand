# Push notifications / การแจ้งเตือนเมื่อ push

Destination: [BiG / #trustcart](https://app.slack.com/client/T04EA6LS2RY/C0CLNMHTGAU).

The `Slack branch push status` GitHub Actions workflow reports pushes to every branch, including names containing `/`. It excludes tag pushes and branch deletions. Messages include repository, branch, pusher, commit subject and commit link. They report the push only, not CI or deployment results. No product data or verification records are sent.

Workflow `Slack branch push status` แจ้งเตือนการ push ทุก branch รวมชื่อที่มี `/` โดยไม่รวม tag และการลบ branch ข้อความระบุ repository, branch, ผู้ push, commit และลิงก์ ไม่ใช่รายงานผลทดสอบหรือ deployment และไม่ส่งข้อมูลสินค้าหรือผลตรวจสอบ

## Activation / การเปิดใช้งาน

1. Create a Slack incoming webhook bound to `#trustcart` in the BiG workspace: https://docs.slack.dev/messaging/sending-messages-using-incoming-webhooks/.
2. Store it as the GitHub Actions repository secret `SLACK_WEBHOOK_URL`. Use GitHub Settings → Secrets and variables → Actions, or `gh secret set SLACK_WEBHOOK_URL` (interactive input). Never paste the credential into chat or commit it.
3. Push this commit to each branch that needs notifications, or merge it into the default branch and incorporate it in other branches. GitHub evaluates push workflows from the pushed branch; older branches lacking this workflow will not notify.
4. Check the workflow run and the message in Slack. A missing credential or failed delivery fails the notification job explicitly. Delivery is not retried automatically to avoid duplicate messages; GitHub workflow reruns can send duplicates.

สร้าง incoming webhook สำหรับ `#trustcart` ใน workspace BiG แล้วบันทึกเป็น GitHub Actions repository secret ชื่อ `SLACK_WEBHOOK_URL` ผ่านหน้า Settings หรือคำสั่งด้านบน ห้ามใส่ credential ในแชตหรือ commit จากนั้น push workflow ไปยังแต่ละ branch ที่ต้องการแจ้งเตือน branch เก่าที่ไม่มี workflow นี้จะยังไม่ส่งข้อความ ตรวจสอบผลใน Actions และ Slack หากยังไม่ได้ตั้ง secret หรือส่งไม่สำเร็จ job จะแสดงข้อผิดพลาด การรัน workflow ซ้ำอาจส่งข้อความซ้ำ

The connected Codex Slack plugin does not supply a reusable webhook credential to GitHub Actions. Setup is incomplete until the secret is configured and the workflow is pushed. No webhook is stored in this checkout.

Slack ที่เชื่อมกับ Codex ไม่ได้ให้ credential สำหรับ GitHub Actions ต้องตั้ง secret และ push workflow ก่อนจึงใช้งานได้ ไม่มีการเก็บ webhook ไว้ใน checkout นี้
