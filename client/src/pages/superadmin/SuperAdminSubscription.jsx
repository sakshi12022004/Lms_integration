import React, { useState, useEffect } from 'react'
import { Shield, Check, ArrowRight, X } from 'lucide-react'
import SuperAdminLayout from '../../components/SuperAdminLayout'

const SuperAdminSubscription = () => {
  const [loading, setLoading] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState('')
  const [currentSubscription, setCurrentSubscription] = useState(null)
  const [planName, setPlanName] = useState('Free')
  const API_BASE = import.meta.env.VITE_BACKEND_URL || 'https://core5.io'

  // Fetch current subscription on mount
  useEffect(() => {
    const fetchCurrentSubscription = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/subscriptions/current`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        })

        const text = await response.text()
        const data = text ? JSON.parse(text) : null

        if (data.success) {
          setCurrentSubscription(data.subscription)
          setPlanName(data.subscription.planName)
        }
      } catch (error) {
        console.error('Error fetching current subscription:', error)
      }
    }

    fetchCurrentSubscription()
  }, [])

  // Add refresh function for subscription updates
  const refreshSubscription = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/subscriptions/current`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })

      const text = await response.text()
      const data = text ? JSON.parse(text) : null

      if (data.success) {
        setCurrentSubscription(data.subscription)
        setPlanName(data.subscription.planName)
        console.log('✅ Subscription refreshed successfully:', data.subscription)
      }
    } catch (error) {
      console.error('Error refreshing subscription:', error)
    }
  }

  // Make refresh function available globally
  useEffect(() => {
    window.refreshSubscription = refreshSubscription
    
    // Listen for subscription refresh events
    const handleSubscriptionRefresh = () => {
      console.log('🔄 Subscription refresh event received')
      refreshSubscription()
    }
    
    window.addEventListener('subscription-refresh', handleSubscriptionRefresh)
    
    // Also listen for storage events (for cross-tab updates)
    const handleStorageChange = (e) => {
      if (e.key === 'subscription-updated') {
        console.log('🔄 Storage change event received')
        refreshSubscription()
      }
    }
    
    window.addEventListener('storage', handleStorageChange)
    
    return () => {
      window.removeEventListener('subscription-refresh', handleSubscriptionRefresh)
      window.removeEventListener('storage', handleStorageChange)
      delete window.refreshSubscription
    }
  }, [])

  const plans = [
    {
      id: 'free',
      name: 'Free',
      price: null,
      description: 'Perfect for getting started',
      features: [
        '1 Schools/Institutes',
        '3 admins',
        '5 mentors',
        '10 students',
        '2 classes',
        '2 courses'
      ],
      buttonText: 'Get Started',
      popular: false
    },
    {
      id: 'standard',
      name: 'Standard',
      price: 1,
      description: 'Great for growing institutions',
      features: [
        '2 Schools/Institutes',
        '5 admins',
        '10 mentors',
        '200 students',
        '10 classes',
        '8 courses'
      ],
      buttonText: 'Choose Standard',
      popular: true
    },
    {
      id: 'professional',
      name: 'Professional',
      price: 1,
      description: 'Complete solution for large institutions',
      features: [
        'Unlimited Schools/Institutes',
        'Unlimited students',
        'Unlimited courses',
        '24/7 priority support',
        'Live classes',
        'Custom branding',
        'API access'
      ],
      buttonText: 'Choose Professional',
      popular: false
    }
  ]

  
  const cancelCurrentSubscription = async () => {
    if (!confirm('Are you sure you want to cancel your subscription and downgrade to Free?')) return;
    
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/api/subscriptions/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const text = await response.text();
      if (!response.ok) throw new Error(`${response.status} ${response.statusText} - ${text || 'no body'}`);
      
      const data = text ? JSON.parse(text) : null;
      if (data && data.success) {
        setCurrentSubscription(data.subscription || null);
        localStorage.setItem('superadminPlanName', 'Free');
        localStorage.setItem('superadminSubscriptionStatus', 'active');
        alert('Subscription cancelled — you have been moved to the Free plan.');
        // Refresh to update layout timer
        setTimeout(() => window.location.reload(), 500);
      } else {
        throw new Error((data && data.message) || 'Failed to cancel subscription');
      }
    } catch (err) {
      console.error('Cancel subscription error:', err);
      alert('Failed to cancel subscription: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  // Fetch current subscription on mount
  useEffect(() => {
    const fetchCurrentSubscription = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/subscriptions/current`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });

        const text = await response.text();
        const data = text ? JSON.parse(text) : null;
        if (data && data.success && data.subscription) {
          console.log('🔍 Current subscription data:', data.subscription);
          setCurrentSubscription(data.subscription);
        }
      } catch (error) {
        console.error('Error fetching current subscription:', error);
      }
    };

    fetchCurrentSubscription();
  }, [API_BASE]);

  const handlePlanSelect = (plan) => {
    if (plan.id === 'free') {
      activateFreeTrial()
      return
    }

    setSelectedPlan(plan.id)
    initiatePayment(plan)
  }

  const activateFreeTrial = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/subscriptions/activate-free-trial`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert('Free trial activated! You now have 10 days to use the superadmin portal.')
        // Refresh the page to update the timer
        window.location.reload()
      } else {
        alert(`Error: ${data.message}`)
      }
    } catch (error) {
      console.error('Error activating free trial:', error)
      alert('Failed to activate free trial')
    }
  }

  const initiatePayment = async (plan) => {
    setLoading(true)
    
    try {
      // Create subscription order
      const orderResponse = await fetch(`${API_BASE}/api/subscriptions/create-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          planId: plan.id,
          planName: plan.name,
          amount: plan.price
        })
      });

      // Read raw text first to avoid json() throwing on empty/non-JSON responses
      const raw = await orderResponse.text();

      if (!orderResponse.ok) {
        const statusText = `${orderResponse.status} ${orderResponse.statusText}`;
        throw new Error(`Create order failed: ${statusText} - ${raw || 'no response body'}`);
      }

      if (!raw || raw.trim() === '') {
        throw new Error('Create order returned empty response');
      }

      let orderData;
      try {
        orderData = JSON.parse(raw);
      } catch (e) {
        throw new Error('Invalid JSON from create-order: ' + raw);
      }

      if (!orderData.success) {
        throw new Error(orderData.message || 'Failed to create subscription order');
      }

      // Load Razorpay script if not already loaded
      if (!window.Razorpay) {
        await loadRazorpayScript();
      }

      // Small delay to ensure Razorpay is fully initialized
      setTimeout(() => {
        openRazorpayCheckout(plan, orderData.order);
      }, 1000);

    } catch (error) {
      console.error('Payment initialization error:', error);
      alert(`Payment failed to initialize: ${error.message}`);
      setLoading(false);
    }
  }

  const loadRazorpayScript = () => {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://checkout.razorpay.com/v1/checkout.js'
      script.async = true
      
      script.onload = () => {
        console.log('Razorpay script loaded successfully')
        resolve()
      }
      
      script.onerror = (error) => {
        console.error('Failed to load Razorpay script:', error)
        reject(new Error('Failed to load payment gateway'))
      }
      
      document.body.appendChild(script)
    })
  }

  const openRazorpayCheckout = (plan, order) => {
    try {
      if (!window.Razorpay) {
        throw new Error('Razorpay not loaded properly')
      }

      const options = {
        key: 'rzp_test_S7aUmYSaQyE0h6',
        order_id: order.id,
        amount: order.amount,
        currency: order.currency,
        name: 'LMS Superadmin Portal',
        description: `${plan.name} Plan Subscription`,
        handler: function (response) {
          console.log('Payment successful:', response)
          activateSubscription(plan.id, plan.name, plan.price, response)
        },
        prefill: {
          name: 'Superadmin User',
          email: 'superadmin@lms.com',
          contact: '9999999999'
        },
        theme: {
          color: '#3B82F6'
        },
        method: {
          upi: true,
          netbanking: true,
          card: true,
          wallet: true,
          emandate: false
        },
        modal: {
          ondismiss: function() {
            console.log('Payment modal dismissed')
            setLoading(false)
          },
          escape: true,
          handleback: true,
          confirm_close: true,
          animation: 'slideFromBottom'
        }
      }

      const rzp = new window.Razorpay(options)
      
      rzp.on('payment.failed', function (response) {
        console.error('Payment failed:', response)
        const errorMessage = response.error?.description || 'Payment failed'
        alert(`Payment failed: ${errorMessage}`)
        setLoading(false)
      })

      rzp.open()

    } catch (error) {
      console.error('Razorpay checkout error:', error)
      alert(`Payment gateway error: ${error.message}`)
      setLoading(false)
    }
  }

  const activateSubscription = async (planId, planName, amount, response) => {
    try {
      setLoading(true)
      
      // Verify payment on backend
      const verifyResponse = await fetch(`${API_BASE}/api/subscriptions/verify-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          orderId: response.razorpay_order_id,
          paymentId: response.razorpay_payment_id,
          signature: response.razorpay_signature,
          planId,
          planName,
          amount,
          durationDays: 30
        })
      });

      const rawVerify = await verifyResponse.text();

      if (!verifyResponse.ok) {
        throw new Error(`Verify payment failed: ${verifyResponse.status} ${verifyResponse.statusText} - ${rawVerify || 'no response body'}`);
      }

      if (!rawVerify || rawVerify.trim() === '') {
        throw new Error('Verify payment returned empty response');
      }

      let verifyData;
      try {
        verifyData = JSON.parse(rawVerify);
      } catch (e) {
        throw new Error('Invalid JSON from verify-payment: ' + rawVerify);
      }

      if (verifyData.success) {
        // Clear any old subscription data from localStorage
        localStorage.removeItem('superadminTimer');
        localStorage.removeItem('superadminTimerTimestamp');
        localStorage.removeItem('superadminTimerActive');
        localStorage.removeItem('superadminTimerExpired');
        localStorage.removeItem('superadminPlanName');
        localStorage.removeItem('superadminSubscriptionStatus');
        
        // Store subscription info in localStorage
        localStorage.setItem('superadminPlanName', planName);
        localStorage.setItem('superadminSubscriptionStatus', 'active');
        
        // Trigger subscription refresh event
        window.dispatchEvent(new CustomEvent('subscription-refresh'));
        
        // Also trigger storage event for cross-tab updates
        localStorage.setItem('subscription-updated', Date.now().toString());
        setTimeout(() => {
          localStorage.removeItem('subscription-updated');
        }, 100);
        
        alert(`? Congratulations! You have successfully upgraded to the ${planName} Plan!`);
        
        // Refresh current subscription data immediately
        setTimeout(() => {
          console.log('Triggering subscription refresh after payment...');
          if (window.refreshSubscription) {
            window.refreshSubscription();
          }
          // Also trigger custom event for immediate refresh
          window.dispatchEvent(new CustomEvent('subscription-refresh'));
          
          // Update local state immediately
          setPlanName(planName);
          
          // Redirect to dashboard after showing success
          setTimeout(() => {
            window.location.href = '/superadmin/dashboard';
          }, 2000);
        }, 500);
      } else {
        alert(`Verification failed: ${verifyData.message}`);
        setLoading(false);
      }
    } catch (error) {
      console.error('Error activating subscription:', error);
      alert(`Failed to activate subscription: ${error.message}`);
      setLoading(false);
    }
  }

  return (
    <SuperAdminLayout>
      <div style={{ minHeight: '100vh', backgroundColor: '#F0F9FF', padding: '48px 16px' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <Shield style={{ color: '#3B82F6', marginBottom: '16px' }} size={48} />
            <h1 style={{ fontSize: '36px', fontWeight: 'bold', color: '#111827', marginBottom: '16px' }}>
              Choose Your Plan
            </h1>
            <p style={{ fontSize: '20px', color: '#6B7280', maxWidth: '768px', margin: '0 auto' }}>
              Select perfect plan for your institution. Start free and upgrade as you grow.
            </p>
          </div>

          {/* Pricing Cards */}
          <div data-tour="subscription-plans" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '32px', marginBottom: '48px' }}>
            {plans.map((plan) => (
              <div
                key={plan.id}
                style={{
                  backgroundColor: 'white',
                  borderRadius: '16px',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                  padding: '32px',
                  transition: 'all 0.3s ease',
                  position: 'relative',
                  border: plan.popular ? '2px solid #3B82F6' : 'none',
                  transform: plan.popular ? 'scale(1.05)' : 'scale(1)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 20px 40px rgba(0,0,0,0.15)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = '0 10px 25px rgba(0,0,0,0.1)'
                }}
              >
                {plan.popular && (
                  <div style={{
                    position: 'absolute',
                    top: '-16px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    backgroundColor: '#3B82F6',
                    color: 'white',
                    padding: '4px 16px',
                    borderRadius: '20px',
                    fontSize: '14px',
                    fontWeight: '600'
                  }}>
                    Most Popular
                  </div>
                )}

                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                  <h3 style={{ fontSize: '24px', fontWeight: 'bold', color: '#111827', marginBottom: '8px' }}>
                    {plan.name}
                    {currentSubscription && currentSubscription.status === 'active' && 
                     (currentSubscription.planType === plan.id || 
                      currentSubscription.planName?.toLowerCase().includes(plan.name.toLowerCase())) && (
                      <span style={{
                        backgroundColor: '#10B981',
                        color: 'white',
                        padding: '4px 12px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: '600',
                        marginLeft: '12px'
                      }}>
                        CURRENT PLAN
                      </span>
                    )}
                  </h3>
                  <p style={{ color: '#6B7280', marginBottom: '24px' }}>{plan.description}</p>
                  
                  {plan.price ? (
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center' }}>
                      <span style={{ fontSize: '36px', fontWeight: 'bold', color: '#111827' }}>
                        ₹{plan.price.toLocaleString('en-IN')}
                      </span>
                      <span style={{ color: '#6B7280', marginLeft: '8px' }}>/year</span>
                    </div>
                  ) : (
                    <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#111827' }}>Free</div>
                  )}
                </div>

                <div style={{ marginBottom: '32px' }}>
                  {plan.features.map((feature, index) => (
                    <div key={index} style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '16px' }}>
                      <Check style={{ color: '#10B981', marginRight: '12px', marginTop: '2px', flexShrink: 0 }} size={20} />
                      <span style={{ color: '#374151', fontSize: '16px' }}>{feature}</span>
                    </div>
                  ))}
                </div>

                {/* Show Cancel button if this is the current active paid plan */}
                {currentSubscription && 
                 currentSubscription.status === 'active' && 
                 plan.id !== 'free' && 
                 (currentSubscription.planType === plan.id || 
                  currentSubscription.planName?.toLowerCase().includes(plan.name.toLowerCase())) ? (
                  <button
                    onClick={cancelCurrentSubscription}
                    disabled={loading}
                    style={{
                      width: '100%',
                      padding: '12px 24px',
                      borderRadius: '8px',
                      fontSize: '16px',
                      fontWeight: '600',
                      border: '2px solid #EF4444',
                      backgroundColor: '#FEE2E2',
                      color: '#DC2626',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      opacity: loading ? 0.5 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      if (!loading) {
                        e.currentTarget.style.backgroundColor = '#FCA5A5';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!loading) {
                        e.currentTarget.style.backgroundColor = '#FEE2E2';
                      }
                    }}
                  >
                    {loading ? (
                      <span>Cancelling...</span>
                    ) : (
                      <>
                        <X size={16} />
                        Cancel Plan
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={() => handlePlanSelect(plan)}
                    disabled={loading}
                    style={{
                      width: '100%',
                      padding: '12px 24px',
                      borderRadius: '8px',
                      fontSize: '16px',
                      fontWeight: '600',
                      border: 'none',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      opacity: loading ? 0.5 : 1,
                      backgroundColor: plan.popular ? '#3B82F6' : plan.id === 'free' ? '#F3F4F6' : '#111827',
                      color: plan.id === 'free' ? '#111827' : 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      if (!loading) {
                        e.currentTarget.style.backgroundColor = plan.popular ? '#2563EB' : plan.id === 'free' ? '#E5E7EB' : '#1F2937'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!loading) {
                        e.currentTarget.style.backgroundColor = plan.popular ? '#3B82F6' : plan.id === 'free' ? '#F3F4F6' : '#111827'
                      }
                    }}
                  >
                    {loading ? (
                      <span style={{ display: 'flex', alignItems: 'center' }}>
                        <svg style={{ animation: 'spin 1s linear infinite', marginRight: '12px', height: '20px', width: '20px' }} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12a8 8 0 01-8 8v0a5.291 5.291 0 0010.585z"></path>
                        </svg>
                        Processing...
                      </span>
                    ) : (
                      <span style={{ display: 'flex', alignItems: 'center' }}>
                        {currentSubscription && currentSubscription.status === 'active' && 
                         (currentSubscription.planType === plan.id || 
                          currentSubscription.planName?.toLowerCase().includes(plan.name.toLowerCase())) ? 
                          'Manage Plan' : 
                          plan.buttonText
                        }
                        {plan.id !== 'free' && <ArrowRight style={{ marginLeft: '8px' }} size={16} />}
                      </span>
                    )}
                  </button>
                )}
              </div>
            ))}
          </div>


        </div>
      </div>
    </SuperAdminLayout>
  )
}

export default SuperAdminSubscription
