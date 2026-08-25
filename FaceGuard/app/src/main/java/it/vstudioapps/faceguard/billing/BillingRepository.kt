package it.vstudioapps.faceguard.billing

import android.app.Activity
import android.content.Context
import com.android.billingclient.api.AcknowledgePurchaseParams
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingClientStateListener
import com.android.billingclient.api.BillingFlowParams
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.Purchase
import com.android.billingclient.api.PurchasesUpdatedListener
import com.android.billingclient.api.QueryProductDetailsParams
import com.android.billingclient.api.QueryPurchasesParams
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Wraps Google Play Billing for the single one-time "FaceGuard Pro" unlock ([PRO_PRODUCT_ID]),
 * which gates the "immagine personalizzata" and "blocco schermo" cover modes — presence
 * detection and recognition itself stay free.
 *
 * Entitlement is not persisted locally: [restorePurchases] re-asks Play on every connection,
 * which is both the source of truth and how a purchase made on another device (or after a
 * reinstall) is picked back up automatically.
 *
 * This code cannot be exercised end to end without a matching in-app product named exactly
 * [PRO_PRODUCT_ID] created in Play Console — there is no way to create or test that from here.
 */
class BillingRepository(context: Context) {

    private val appContext = context.applicationContext

    private val _isPro = MutableStateFlow(false)
    val isPro = _isPro.asStateFlow()

    private val _proPriceLabel = MutableStateFlow<String?>(null)
    val proPriceLabel = _proPriceLabel.asStateFlow()

    private var proProductDetails: ProductDetails? = null

    private val purchasesUpdatedListener = PurchasesUpdatedListener { result, purchases ->
        if (result.responseCode == BillingClient.BillingResponseCode.OK) {
            purchases?.forEach { handlePurchase(it) }
        }
    }

    private val client: BillingClient = BillingClient.newBuilder(appContext)
        .setListener(purchasesUpdatedListener)
        .enablePendingPurchases()
        .build()

    fun connect() {
        if (client.isReady) return
        client.startConnection(object : BillingClientStateListener {
            override fun onBillingSetupFinished(billingResult: BillingResult) {
                if (billingResult.responseCode == BillingClient.BillingResponseCode.OK) {
                    queryProProductDetails()
                    restorePurchases()
                }
            }

            override fun onBillingServiceDisconnected() {
                // The next connect() call (e.g. reopening the Pro screen) retries the connection.
            }
        })
    }

    private fun queryProProductDetails() {
        val product = QueryProductDetailsParams.Product.newBuilder()
            .setProductId(PRO_PRODUCT_ID)
            .setProductType(BillingClient.ProductType.INAPP)
            .build()
        val params = QueryProductDetailsParams.newBuilder().setProductList(listOf(product)).build()
        client.queryProductDetailsAsync(params) { _, productDetailsList ->
            proProductDetails = productDetailsList.firstOrNull()
            _proPriceLabel.value = proProductDetails?.oneTimePurchaseOfferDetails?.formattedPrice
        }
    }

    /** Re-checks entitlement with Play — also how a purchase from another install is restored. */
    fun restorePurchases() {
        val params = QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build()
        client.queryPurchasesAsync(params) { _, purchases ->
            _isPro.value = purchases.any {
                it.products.contains(PRO_PRODUCT_ID) && it.purchaseState == Purchase.PurchaseState.PURCHASED
            }
            purchases.forEach { handlePurchase(it) }
        }
    }

    fun launchPurchase(activity: Activity) {
        val details = proProductDetails ?: return
        val productParams = BillingFlowParams.ProductDetailsParams.newBuilder()
            .setProductDetails(details)
            .build()
        val flowParams = BillingFlowParams.newBuilder()
            .setProductDetailsParamsList(listOf(productParams))
            .build()
        client.launchBillingFlow(activity, flowParams)
    }

    private fun handlePurchase(purchase: Purchase) {
        if (purchase.purchaseState != Purchase.PurchaseState.PURCHASED) return
        if (!purchase.products.contains(PRO_PRODUCT_ID)) return

        _isPro.value = true

        if (!purchase.isAcknowledged) {
            val params = AcknowledgePurchaseParams.newBuilder()
                .setPurchaseToken(purchase.purchaseToken)
                .build()
            client.acknowledgePurchase(params) { }
        }
    }

    fun disconnect() {
        client.endConnection()
    }

    companion object {
        const val PRO_PRODUCT_ID = "faceguard_pro_unlock"
    }
}
