# Cấu hình SAP Default Identity Provider

## Vấn đề

Khi BTP tenant có nhiều Identity Provider (IdP), user có thể thấy trang **"Choose Identity Provider"** thay vì vào thẳng form đăng nhập. Điều này gây nhầm lẫn vì user không biết chọn IdP nào.

## Giải pháp

Thêm `"identityProvider": "sap.default"` vào **mọi route** có `authenticationType: "xsuaa"` trong `xs-app.json`.

```json
{
  "source": "^(.*)$",
  "authenticationType": "xsuaa",
  "identityProvider": "sap.default"
}
```

XSUAA sẽ bỏ qua trang chọn IdP và redirect thẳng đến **IdP mặc định** của tenant (thường là SAP IAS corporate login).

## Áp dụng

### Standalone Approuter — `app/router/xs-app.json`

Tất cả route cần auth phải có `identityProvider`:

```json
{
  "routes": [
    {
      "source": "^/odata/v4/(.*)$",
      "authenticationType": "xsuaa",
      "identityProvider": "sap.default",
      "destination": "srv-api"
    },
    {
      "source": "^/api/(.*)$",
      "authenticationType": "xsuaa",
      "identityProvider": "sap.default",
      "destination": "srv-api"
    },
    {
      "source": "^(.*)$",
      "authenticationType": "xsuaa",
      "identityProvider": "sap.default",
      "localDir": "resources/cnma"
    }
  ]
}
```

### Managed Approuter — `app/cnma_vj_my_inbox_ui/public/xs-app.json`

```json
{
  "routes": [
    {
      "source": "^/api/inbox/(.*)$",
      "authenticationType": "xsuaa",
      "identityProvider": "sap.default",
      "destination": "cnma_vj_my_inbox_destination"
    },
    {
      "source": "^(.*)$",
      "authenticationType": "xsuaa",
      "identityProvider": "sap.default",
      "service": "html5-apps-repo-rt"
    }
  ]
}
```

## Lưu ý

- Route có `authenticationType: "none"` **không cần** `identityProvider` (không yêu cầu auth)
- Nếu thiếu `identityProvider` ở **bất kỳ route nào**, user truy cập route đó có thể thấy trang chọn IdP
- Giá trị `sap.default` tham chiếu đến IdP được đánh dấu "Default" trong BTP cockpit → Trust Configuration
