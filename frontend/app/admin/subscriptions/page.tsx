"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { useI18n } from "@/lib/i18n-context"
import { apiClient } from "@/lib/api-client"
import { ProtectedRoute } from "@/components/protected-route"
import { Loader2, Trash2, Edit2 } from "lucide-react"

interface Subscription {
  id: string; // Subscription ID
  user: {
    _id: string;
    username: string;
    email: string;
  };
  plan: { name: string };
  planSlug: string;
  status: string
  currentPeriodEnd: string;
}

export default function SubscriptionsPage() {
  const { t } = useI18n()
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [selectedPlan, setSelectedPlan] = useState<string>("")
  const [editingUserId, setEditingUserId] = useState<string | null>(null)

  useEffect(() => {
    loadSubscriptions()
  }, [])

  const loadSubscriptions = async () => {
    try {
      setLoading(true)
      const response = await apiClient.getAdminSubscriptions()
      setSubscriptions(response.data || [])
    } catch (err: any) {
      setError(err.message || "Failed to load subscriptions")
    } finally {
      setLoading(false)
    }
  }

  // Sửa tên tham số từ planId thành planSlug để rõ ràng hơn
  const handleUpdateSubscription = async (subscriptionId: string, planSlug: string) => {
    try {
      await apiClient.updateUserSubscription(subscriptionId, { planSlug }) // Gửi planSlug thay vì planId
      setEditingUserId(null)
      loadSubscriptions()
    } catch (err: any) {
      setError(err.message || "Failed to update subscription")
    }
  }

  const handleCancelSubscription = async (subscriptionId: string) => {
    if (!confirm(t("admin.confirmCancel") || "Are you sure?")) return

    try {
      await apiClient.cancelUserSubscription(subscriptionId)
      loadSubscriptions()
    } catch (err: any) {
      setError(err.message || "Failed to cancel subscription")
    }
  }

  return (
    <ProtectedRoute requireAdmin>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">{t("admin.subscriptions") || "Subscriptions"}</h1>
          <p className="text-muted-foreground">{t("admin.manageUserSubscriptions") || "Manage user subscriptions"}</p>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">{error}</div>}

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4">{t("admin.user") || "User"}</th>
                  <th className="text-left py-3 px-4">{t("admin.email") || "Email"}</th>
                  <th className="text-left py-3 px-4">{t("admin.plan") || "Plan"}</th>
                  <th className="text-left py-3 px-4">{t("admin.status") || "Status"}</th>
                  <th className="text-left py-3 px-4">{t("admin.expiresAt") || "Expires At"}</th>
                  <th className="text-left py-3 px-4">{t("admin.actions") || "Actions"}</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.map((sub) => (
                  <tr key={sub.id} className="border-b hover:bg-muted/50">
                    <td className="py-3 px-4">{sub.user.username}</td>
                    <td className="py-3 px-4">{sub.user.email}</td>
                    <td className="py-3 px-4">
                      {editingUserId === sub.id ? (
                        <select
                          value={selectedPlan}
                          onChange={(e) => setSelectedPlan(e.target.value)}
                          className="px-2 py-1 border rounded"
                        >
                          <option value="free">Free</option>
                          <option value="starter">Starter</option>
                          <option value="professional">Professional</option>
                          <option value="enterprise">Enterprise</option>
                        </select>
                      ) : (
                        <span className="capitalize">{sub.planSlug}</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-1 rounded text-sm ${sub.status === "active" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}
                      >
                        {sub.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">{new Date(sub.currentPeriodEnd).toLocaleDateString()}</td>
                    <td className="py-3 px-4">
                      <div className="flex gap-2">
                        {editingUserId === sub.id ? (
                          <>
                            <Button size="sm" onClick={() => handleUpdateSubscription(sub.id, selectedPlan)}>
                              {t("common.save") || "Save"}
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setEditingUserId(null)}>
                              {t("common.cancel") || "Cancel"}
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingUserId(sub.id)
                                setSelectedPlan(sub.planSlug)
                              }}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleCancelSubscription(sub.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </ProtectedRoute>
  )
}
