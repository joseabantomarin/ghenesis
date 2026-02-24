import React from 'react';
import * as Icons from '@mui/icons-material';

const IconMap = {
    // General & Navegación
    Home: Icons.Home,
    Settings: Icons.Settings,
    Search: Icons.Search,
    Menu: Icons.Menu,
    Notifications: Icons.Notifications,
    Info: Icons.Info,
    Help: Icons.Help,
    Refresh: Icons.Refresh,
    Close: Icons.Close,
    Save: Icons.Save,
    Delete: Icons.Delete,
    Add: Icons.Add,
    Edit: Icons.Edit,
    History: Icons.History,
    Star: Icons.Star,

    // Personas & RRHH
    Person: Icons.Person,
    People: Icons.People,
    PersonAdd: Icons.PersonAdd,
    Badge: Icons.Badge,
    Contacts: Icons.Contacts,
    Group: Icons.Group,
    Work: Icons.Work,
    SupervisorAccount: Icons.SupervisorAccount,

    // Finanzas & Contabilidad
    Payments: Icons.Payments,
    AccountBalance: Icons.AccountBalance,
    AccountBalanceWallet: Icons.AccountBalanceWallet,
    Receipt: Icons.Receipt,
    RequestQuote: Icons.RequestQuote,
    ReceiptLong: Icons.ReceiptLong,
    AttachMoney: Icons.AttachMoney,
    Paid: Icons.Paid,
    MonetizationOn: Icons.MonetizationOn,
    PointOfSale: Icons.PointOfSale,
    Calculate: Icons.Calculate,

    // Logística & Inventario
    Inventory: Icons.Inventory,
    LocalShipping: Icons.LocalShipping,
    Warehouse: Icons.Warehouse,
    ShoppingCart: Icons.ShoppingCart,
    Store: Icons.Store,
    Dashboard: Icons.Dashboard,
    Inventory2: Icons.Inventory2,

    // Documentos & Reportes
    Description: Icons.Description,
    ContentPaste: Icons.ContentPaste,
    Assignment: Icons.Assignment,
    FactCheck: Icons.FactCheck,
    Rule: Icons.Rule,
    Article: Icons.Article,
    Assessment: Icons.Assessment,
    AutoGraph: Icons.AutoGraph,
    PieChart: Icons.PieChart,
    BarChart: Icons.BarChart,
    TableChart: Icons.TableChart,
    Analytics: Icons.Analytics,
    ListAlt: Icons.ListAlt,
    ViewList: Icons.ViewList,
    ViewModule: Icons.ViewModule,

    // Comunicación
    Email: Icons.Email,
    Phone: Icons.Phone,
    Chat: Icons.Chat,
    Forum: Icons.Forum,

    // Tiempo & Agenda
    Event: Icons.Event,
    Schedule: Icons.Schedule,
    Today: Icons.Today,
    AccessTime: Icons.AccessTime,

    // Empresa & Negocio
    Business: Icons.Business,
    CorporateFare: Icons.CorporateFare,
    Storefront: Icons.Storefront,
    Domain: Icons.Domain,
    Factory: Icons.Factory,

    // Seguridad
    Shield: Icons.Shield,
    Lock: Icons.Lock,
    VpnKey: Icons.VpnKey,
    LockOpen: Icons.LockOpen,
    Key: Icons.Key,
    Gavel: Icons.Gavel,
    Verified: Icons.Verified,

    // Infraestructura & Datos
    Storage: Icons.Storage,
    Dvr: Icons.Dvr,
    Lan: Icons.Lan,
    Cloud: Icons.Cloud,
    Terminal: Icons.Terminal,
    AccountTree: Icons.AccountTree,

    // Otros Utilitarios
    Public: Icons.Public,
    Map: Icons.Map,
    Place: Icons.Place,
    Build: Icons.Build,
    Grade: Icons.Grade,
    Speed: Icons.Speed,
    Tune: Icons.Tune,
    Layers: Icons.Layers,
    Widgets: Icons.Widgets,
    Folder: Icons.Folder,
    Attachment: Icons.Attachment,
    CloudUpload: Icons.CloudUpload,
    CloudDownload: Icons.CloudDownload,
    Print: Icons.Print,
    Share: Icons.Share,
    Launch: Icons.Launch,
    OpenInNew: Icons.OpenInNew,
    Login: Icons.Login,
    Logout: Icons.Logout,

    // Alias y Compatibilidad
    Programador: Icons.Terminal,
    General: Icons.Storage,
    Operaciones: Icons.PlayCircle,
    Sistema: Icons.SystemUpdateAlt,
    Roles: Icons.Shield,
    Users: Icons.People,
    Password: Icons.VpnKey
};

const DynamicIcon = ({ name, fontSize = "small", color, sx }) => {
    const IconComponent = IconMap[name] || Icons.Article;
    return <IconComponent fontSize={fontSize} sx={{ color, ...sx }} />;
};

export default DynamicIcon;
